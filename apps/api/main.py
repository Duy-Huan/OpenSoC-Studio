import asyncio
import base64
import binascii
import io
import json
import os
import stat
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from .domain import DomainError, validate_soc
from .models import ProjectCreate, ImportRequest, SourceFile, AnalyzeRequest, LayoutRequest, PackageRequest, ReviewRequest, ReuseRequest, SoCConfig, RunRequest, FirmwareRequest
from .firmware import inspect_elf, IBEX
from .services import Studio, TERMINAL, now
from .storage import Store, canonical, digest
from . import reference
from .models import RuntimeRequest
from .runtime import Runtime

REPO = Path(__file__).resolve().parents[2]
ORIGINS = {'http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:8000', 'http://localhost:8000'}


def failure(code, message, status=422, details=None):
    return JSONResponse({'code': code, 'message': message, 'details': details or [], 'correlation_id': uuid4().hex}, status_code=status)


class LocalBoundary:
    """Local browser origin/host guard and bounded HTTP bodies, not multi-user auth."""
    def __init__(self, app): self.app = app
    async def __call__(self, scope, receive, send):
        if scope['type'] not in {'http', 'websocket'}: return await self.app(scope, receive, send)
        headers = dict(scope.get('headers', []))
        host = headers.get(b'host', b'').decode().split(':')[0]
        origin = headers.get(b'origin', b'').decode()
        if host not in {'127.0.0.1', 'localhost', 'testserver'} or (origin and origin not in ORIGINS):
            if scope['type'] == 'websocket': return await send({'type': 'websocket.close', 'code': 1008})
            return await failure('LOCAL_ACCESS_ONLY', 'Only local workbench origins are allowed', 403)(scope, receive, send)
        if scope['type'] == 'http' and scope['method'] in {'POST', 'PATCH', 'PUT', 'DELETE'}:
            if headers.get(b'x-opensoc-client') != b'workbench':
                return await failure('CLIENT_HEADER_REQUIRED', 'Local state changes require the workbench client header', 403)(scope, receive, send)
            chunks, size = [], 0
            while True:
                message = await receive()
                if message['type'] == 'http.disconnect': return
                size += len(message.get('body', b''))
                if size > 4_500_000:
                    return await failure('BODY_QUOTA', 'Request exceeds 4.5 MB', 413)(scope, receive, send)
                chunks.append(message.get('body', b''))
                if not message.get('more_body'): break
            body = b''.join(chunks)
            delivered = False
            async def replay():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {'type': 'http.request', 'body': body, 'more_body': False}
                return await receive()
            return await self.app(scope, replay, send)
        return await self.app(scope, receive, send)


def create_app(root: Path | None = None, reference_root: Path | None = None):
    data_root = root or Path(os.environ.get('OPENSOC_DATA_ROOT', REPO / '.opensoc'))
    reference_root = reference_root or REPO
    @asynccontextmanager
    async def lifespan(app):
        app.state.studio = Studio(Store(data_root))
        app.state.runtime = Runtime(app.state.studio)
        yield
        app.state.runtime.close()
        app.state.studio.close()
    app = FastAPI(title='OpenSoC Studio', version='0.2.0', lifespan=lifespan)
    app.add_middleware(LocalBoundary)
    def studio() -> Studio: return app.state.studio

    @app.exception_handler(DomainError)
    async def domain_error(_, exc): return failure(exc.code, exc.message, exc.status, exc.details)

    @app.exception_handler(RequestValidationError)
    async def request_error(_, exc):
        return failure('CONTRACT_INVALID', 'Request does not satisfy the versioned contract', 422, [{'location': list(e['loc']), 'message': e['msg']} for e in exc.errors()])

    @app.get('/api/v1/health')
    def health(): return {'status': 'ok', 'schema_version': '1.0', 'ai_policy': 'NO_AI', 'mode': 'local_single_user', 'simulation_enabled': False,'fixed_reference_runtime_enabled':(REPO/'.tools/runtime-ready.json').is_file()}

    @app.get('/api/v1/projects')
    def projects(): return studio().store.list('project')

    @app.get('/api/v1/reference-regression')
    def reference_regression(): return reference.evidence(reference_root)

    @app.get('/api/v1/reference-regression/{evidence_id}/artifacts/{artifact_id}')
    def reference_artifact(evidence_id: str, artifact_id: str):
        path = reference.artifact(reference_root, evidence_id, artifact_id)
        return FileResponse(path, filename=path.name, media_type='application/octet-stream')

    @app.get('/api/v1/runtime/capabilities')
    def runtime_capabilities(): return app.state.runtime.capabilities()

    @app.post('/api/v1/runtime/runs',status_code=202)
    def runtime_start(body: RuntimeRequest): return app.state.runtime.start(body)

    @app.get('/api/v1/runtime/runs')
    def runtime_runs(project_id: str):
        studio().require('project',project_id)
        return studio().store.list('runtime-run',project_id)

    @app.get('/api/v1/runtime/runs/{run_id}')
    def runtime_get(run_id: str): return app.state.runtime.require(run_id)

    @app.post('/api/v1/runtime/runs/{run_id}/cancel')
    def runtime_cancel(run_id: str): return app.state.runtime.cancel(run_id)

    @app.get('/api/v1/runtime/runs/{run_id}/events')
    def runtime_events(run_id: str, after_seq: int = Query(0,ge=0)):
        app.state.runtime.require(run_id)
        return studio().store.events(run_id,after_seq,5000)

    @app.get('/api/v1/runtime/runs/{run_id}/artifacts/{artifact_id}')
    def runtime_artifact(run_id: str,artifact_id: str):
        path=app.state.runtime.artifact(run_id,artifact_id)
        return FileResponse(path,filename=path.name,media_type='application/octet-stream')

    @app.get('/api/v1/runtime/runs/{run_id}/waveform/{artifact_id}')
    def runtime_waveform(run_id: str,artifact_id: str,start: str='0',end: str='1000000',ids: str=''):
        return app.state.runtime.waveform(run_id,artifact_id,start,end,ids)

    @app.post('/api/v1/projects', status_code=201)
    def project(body: ProjectCreate): return studio().project(body.name)

    @app.get('/api/v1/projects/{project_id}')
    def get_project(project_id: str): return studio().require('project', project_id)

    @app.get('/api/v1/projects/{project_id}/workspace')
    def workspace(project_id: str):
        studio().require('project', project_id)
        return studio().store.get('layout', project_id) or {'revision': 0, 'layout': {}}

    @app.put('/api/v1/projects/{project_id}/workspace')
    def save_workspace(project_id: str, body: LayoutRequest):
        s = studio(); s.require('project', project_id)
        if len(canonical(body.layout)) > 250000: raise DomainError('LAYOUT_QUOTA', 'Workspace layout exceeds 250 KB', 429)
        with s.store.lock:
            previous = s.store.get('layout', project_id) or {'revision': 0}
            if previous['revision'] != body.revision: raise DomainError('REVISION_CONFLICT', 'Workspace changed; reload before saving', 409)
            item = {'revision': body.revision+1, 'layout': body.layout}
            s.store.put('layout', project_id, item, project_id)
        return item

    @app.get('/api/v1/projects/{project_id}/rtl-imports')
    def imports(project_id: str):
        studio().require('project', project_id)
        return studio().store.list('import', project_id)

    @app.post('/api/v1/projects/{project_id}/rtl-imports', status_code=201)
    def import_rtl(project_id: str, body: ImportRequest): return studio().import_sources(project_id, body)

    @app.post('/api/v1/projects/{project_id}/rtl-archives', status_code=201)
    async def import_archive(project_id: str, request: Request):
        payload = await request.body()
        try:
            with zipfile.ZipFile(io.BytesIO(payload)) as archive:
                info = archive.infolist()
                if len(info) > 128 or sum(i.file_size for i in info) > 4000000: raise DomainError('ARCHIVE_QUOTA', 'Archive has too many entries or expanded bytes', 429)
                files = []
                for entry in info:
                    if entry.is_dir(): continue
                    if stat.S_ISLNK(entry.external_attr >> 16) or entry.flag_bits & 1: raise DomainError('UNSAFE_ARCHIVE', 'Symlinks and encrypted entries are not supported')
                    if entry.file_size > 1000000 or entry.file_size > max(entry.compress_size, 1)*100: raise DomainError('ARCHIVE_QUOTA', 'Archive compression ratio/entry size exceeds limit', 429)
                    files.append(SourceFile(path=entry.filename, content=archive.read(entry).decode('utf-8')))
            if not files: raise DomainError('EMPTY_ARCHIVE', 'Archive contains no RTL sources')
            return studio().import_sources(project_id, ImportRequest(files=files))
        except (zipfile.BadZipFile, UnicodeDecodeError, ValueError) as exc:
            raise DomainError('INVALID_ARCHIVE', 'Expected a UTF-8 RTL ZIP archive') from exc

    @app.get('/api/v1/rtl-imports/{import_id}')
    def get_import(import_id: str): return studio().require('import', import_id)

    @app.get('/api/v1/rtl-imports/{import_id}/sources/{source_id}')
    def get_source(import_id: str, source_id: str):
        item = studio().require('import', import_id)
        source = next((f for f in item['files'] if f['id'] == source_id), None)
        if source is None: raise DomainError('NOT_FOUND', 'Source not found in this snapshot', 404)
        return {**source, 'content': (studio().store.blobs / source['sha256']).read_text(encoding='utf-8')}

    @app.post('/api/v1/rtl-imports/{import_id}/analyze', status_code=202)
    def analyze(import_id: str, body: AnalyzeRequest): return studio().start_analysis(import_id, body.top)

    @app.get('/api/v1/projects/{project_id}/runs')
    def runs(project_id: str):
        studio().require('project', project_id)
        return studio().store.list('run', project_id)

    @app.get('/api/v1/runs/{run_id}')
    def run(run_id: str): return studio().require('run', run_id)

    @app.post('/api/v1/runs/{run_id}/cancel')
    def cancel(run_id: str): return studio().cancel(run_id)

    @app.get('/api/v1/runs/{run_id}/events')
    def events(run_id: str, after_seq: int = Query(default=0, ge=0)):
        studio().require('run', run_id)
        return studio().store.events(run_id, after_seq)

    @app.websocket('/api/v1/runs/{run_id}/stream')
    async def stream(websocket: WebSocket, run_id: str, after_seq: int = 0):
        try:
            studio().require('run', run_id)
            if after_seq < 0: raise DomainError('INVALID_SEQUENCE', 'after_seq must be nonnegative')
        except DomainError:
            await websocket.close(code=1008); return
        await websocket.accept()
        cursor = after_seq
        try:
            while True:
                batch = studio().store.events(run_id, cursor)
                for event in batch:
                    await websocket.send_json(event); cursor = event['seq']
                if not batch and studio().require('run', run_id)['state'] in TERMINAL:
                    await websocket.close(code=1000); return
                await asyncio.sleep(0.08)
        except WebSocketDisconnect: pass

    @app.get('/api/v1/runs/{run_id}/artifacts')
    def artifacts(run_id: str): return studio().require('run', run_id)['artifacts']

    @app.get('/api/v1/runs/{run_id}/artifacts/{artifact_id}')
    def artifact(run_id: str, artifact_id: str):
        run = studio().require('run', run_id)
        item = next((a for a in run['artifacts'] if a['id'] == artifact_id), None)
        if item is None: raise DomainError('NOT_FOUND', 'Artifact does not belong to this run', 404)
        return FileResponse(studio().store.blobs / item['sha256'], media_type=item['media_type'], filename=f'{item["kind"]}-{item["sha256"][:12]}.json')

    @app.get('/api/v1/runs/{run_id}/evidence')
    def evidence(run_id: str):
        run = studio().require('run', run_id)
        return {'schema_version': '1.0', 'run': run, 'events': studio().store.events(run_id, 0, 5000), 'note': 'RTL analysis evidence only. No simulation or protocol verification.'}

    @app.post('/api/v1/runs', status_code=424)
    def simulation(body: RunRequest):
        studio().require('project', body.project_id)
        raise DomainError('SIMULATION_WORKER_UNAVAILABLE', 'This lane needs a verified isolated native worker and board/toolchain profile. No simulation was started.', 424, [{'lane': body.lane, 'status': 'UNSUPPORTED', 'simulation_executed': False}])

    @app.get('/api/v1/cpu-providers')
    def providers():
        lock = json.loads((REPO/'docs/compliance/upstream-lock.json').read_text(encoding='utf-8'))
        result=[{'id': name, 'revision': next(c['revision'] for c in lock['components'] if c['name'] == source), 'status': 'UNSUPPORTED', 'reason': reason, 'evidence_ids': []} for name, source, reason in [
            ('lowrisc_ibex', 'ibex', 'Ibex RTL firmware spike has not executed; no native worker configured.'),
            ('chipyard_rocket', 'chipyard', 'Generator/submodule/toolchain profile has not been validated.'),
            ('opentitan', 'opentitan', 'Full SoC / TL-UL profile has not been validated.'),
            ('gem5_arch', 'gem5', 'Approximate architecture CPU model, not vendor CPU RTL. No board worker configured.'),
            ('gem5_hybrid', 'gem5', 'SystemC bridge and RTL transactor acceptance remain open.')]]
        ready={p['id']:p['available'] for p in app.state.runtime.capabilities()['profiles']}
        for item,profile in [(result[0],'ibex_simple_system'),(result[3],'gem5_riscv')]:
            if ready.get(profile): item.update(status='EXPERIMENTAL',runtime_profile_id=profile,reason='Prepared fixed reference in Engine Runtime; general Composer execution remains unavailable.')
        return result

    @app.get('/api/v1/firmware/profiles')
    def firmware_profiles():
        return [{**IBEX, 'memory_base': hex(IBEX['memory_base']), 'memory_size': hex(IBEX['memory_size']), 'boot_entry': hex(IBEX['boot_entry']), 'limitations': 'Header/segment checks only. ISA extensions, firmware semantics and CPU boot remain unverified.'}]

    @app.post('/api/v1/firmware/import', status_code=201)
    def import_firmware(body: FirmwareRequest):
        s = studio(); s.require('project', body.project_id)
        try: data = base64.b64decode(body.content_base64, validate=True)
        except (binascii.Error, ValueError) as exc: raise DomainError('FIRMWARE_ENCODING_INVALID', 'Expected base64 ELF bytes') from exc
        if len(data) > 2_000_000: raise DomainError('FIRMWARE_QUOTA', 'ELF import limit is 2 MB', 429)
        result = inspect_elf(data)
        sha = s.store.blob(data)
        item = {**result, 'id': f'firmware-{sha}', 'project_id': body.project_id, 'filename': body.filename, 'artifact_sha256': sha, 'size': len(data), 'created_at': now(), 'rights': 'USER_SOURCE_REVIEW_REQUIRED'}
        s.store.put('firmware', f'{body.project_id}:{item["id"]}', item, body.project_id)
        return item

    @app.get('/api/v1/projects/{project_id}/firmware')
    def firmware(project_id: str):
        studio().require('project', project_id)
        return studio().store.list('firmware', project_id)

    @app.post('/api/v1/ip-packages', status_code=201)
    def draft(body: PackageRequest): return studio().draft(body)

    @app.get('/api/v1/ip-registry')
    def registry(query: str = ''):
        return [p for p in studio().store.list('package') if query.lower() in p['id'].lower()]

    @app.post('/api/v1/ip-packages/{package_id}/review')
    def review(package_id: str, body: ReviewRequest):
        s = studio()
        with s.store.lock:
            p = s.require('package', package_id)
            if p['status'] != 'DRAFT': return p
            if p['rights']['license_expression'] in {'NOASSERTION', 'UNKNOWN', 'UNLICENSED'}: raise DomainError('RIGHTS_REVIEW_REQUIRED', 'Specify source rights in a new import before reviewing the package')
            p.update(status='REVIEWED', reviewed_by=body.reviewer, reviewed_at=now())
            s.store.put('package', package_id, p, p['project_id'])
        return p

    @app.post('/api/v1/ip-packages/{package_id}/publish')
    def publish(package_id: str):
        studio().require('package', package_id)
        raise DomainError('VERIFICATION_REQUIRED', 'Publication is blocked: no deterministic simulator/protocol evidence exists for this package', 424)

    @app.post('/api/v1/ip-packages/{package_id}/reuse')
    def reuse(package_id: str, body: ReuseRequest):
        s = studio(); s.require('project', body.project_id); p = s.require('package', package_id)
        if p['status'] != 'REVIEWED': raise DomainError('PACKAGE_NOT_REVIEWED', 'Review the package before reuse')
        item = {'package_id': p['id'], 'content_sha256': p['content_sha256'], 'project_id': body.project_id, 'simulation_verified': False, 'knowledge_level': 'REVIEWED', 'created_at': now()}
        s.store.put('dependency', f'{body.project_id}:{package_id}', item, body.project_id)
        return item

    @app.get('/api/v1/projects/{project_id}/dependencies')
    def dependencies(project_id: str):
        studio().require('project', project_id)
        return studio().store.list('dependency', project_id)

    @app.get('/api/v1/projects/{project_id}/soc-config')
    def soc(project_id: str):
        studio().require('project', project_id)
        return studio().store.get('soc', project_id) or SoCConfig(id=f'soc-{project_id}', project_id=project_id, revision=0).model_dump(by_alias=True)

    def topology_errors(body):
        errors = validate_soc(body)
        for instance in body.instances:
            if studio().store.get('package', instance.ip_id) is None:
                errors.append({'code': 'UNRESOLVED_IP_REFERENCE', 'id': instance.id, 'message': 'Choose an immutable package from the local registry'})
        return errors

    @app.post('/api/v1/soc-configs/{soc_id}/validate')
    def check_soc(soc_id: str, body: SoCConfig):
        studio().require('project', body.project_id)
        if body.id != soc_id: raise DomainError('SOC_ID_MISMATCH', 'URL and document SoC IDs differ')
        errors = topology_errors(body)
        return {'valid': not errors, 'errors': errors, 'scope': 'TOPOLOGY_ONLY', 'simulation_verified': False}

    @app.patch('/api/v1/soc-configs/{soc_id}')
    def save_soc(soc_id: str, body: SoCConfig, request: Request):
        s = studio(); s.require('project', body.project_id)
        if body.id != soc_id: raise DomainError('SOC_ID_MISMATCH', 'URL and document SoC IDs differ')
        errors = topology_errors(body)
        if errors: raise DomainError('SOC_CONFIG_INVALID', 'Topology was not committed; resolve the indicated node/edge errors', 422, errors)
        with s.store.lock:
            previous = s.store.get('soc', body.project_id)
            revision = previous['revision'] if previous else 0
            if body.revision != revision or request.headers.get('if-match') != str(revision): raise DomainError('REVISION_CONFLICT', 'Topology changed; reload before committing', 409)
            value = body.model_dump(by_alias=True); value['revision'] += 1
            s.store.put('soc', body.project_id, value, body.project_id)
            s.store.put('soc-history', f'{soc_id}:{value["revision"]}', {'config': value, 'sha256': digest(canonical(value).encode()), 'created_at': now()}, body.project_id, immutable=True)
        return JSONResponse(value, headers={'ETag': str(value['revision'])})

    dist = REPO / 'apps/web/dist'
    if dist.exists(): app.mount('/', StaticFiles(directory=dist, html=True), name='workbench')
    return app


app = create_app()
