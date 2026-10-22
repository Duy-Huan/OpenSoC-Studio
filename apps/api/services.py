import json
import re
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from importlib.metadata import version
from .domain import DomainError, safe_sources
from .storage import Store, canonical, digest


def identifier(prefix): return f'{prefix}-{uuid.uuid4().hex[:16]}'
def now(): return datetime.now(timezone.utc).isoformat()
TERMINAL = {'COMPLETED_PASS', 'COMPLETED_FAIL', 'FAILED_INFRA', 'TIMED_OUT', 'CANCELLED', 'BLOCKED'}
TRANSITIONS = {'CREATED': {'VALIDATING'}, 'VALIDATING': {'QUEUED'}, 'QUEUED': {'RUNNING'}, 'RUNNING': {'COLLECTING'}, 'COLLECTING': {'VERIFYING'}, 'VERIFYING': {'COMPLETED_PASS', 'COMPLETED_FAIL'}}


class Studio:
    def __init__(self, store: Store):
        self.store = store
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix='rtl-analysis')
        self.control = threading.RLock()
        self.processes = {}
        # A server restart cannot leave a run apparently executing forever.
        for run in store.list('run'):
            if run['state'] not in TERMINAL:
                self.state(run['id'], 'FAILED_INFRA', 'SERVER_RESTARTED')

    def require(self, kind, value):
        result = self.store.get(kind, value)
        if result is None: raise DomainError('NOT_FOUND', f'{kind} not found', 404)
        return result

    def project(self, name):
        p = {'id': identifier('project'), 'name': name.strip(), 'created_at': now(), 'ai_policy': 'NO_AI', 'revision': 0}
        if not p['name']: raise DomainError('INVALID_NAME', 'Project name must not be blank')
        self.store.put('project', p['id'], p, p['id'], immutable=True)
        return p

    def import_sources(self, project_id, request):
        self.require('project', project_id)
        parent = self.require('import', request.parent_import_id) if request.parent_import_id else None
        if parent and parent['project_id'] != project_id:
            raise DomainError('SOURCE_PROJECT_MISMATCH', 'Derived snapshots must belong to the same project')
        hashes = safe_sources(request.files)
        # Host reads through preprocessor includes are forbidden until an OS sandbox exists.
        for source in request.files:
            if re.search(r'`\s*(include|line|pragma)\b', source.content):
                raise DomainError('PREPROCESSOR_REQUIRES_SANDBOX', 'Includes, line and pragma directives are not enabled in the local parser. Upload a reviewed self-contained fileset.')
        files = []
        for source, info in zip(request.files, hashes):
            sha = self.store.blob(source.content.encode())
            files.append({**info, 'artifact_id': sha, 'id': f'source-{digest((source.path+sha).encode())[:24]}'})
        # File order is part of compiler input semantics and therefore part of the pin.
        snapshot = digest(canonical(hashes).encode())
        item = {'id': identifier('import'), 'project_id': project_id, 'schema_version': '1.0', 'created_at': now(), 'snapshot_sha256': snapshot, 'files': files,
            'rights': {'license_expression': request.license_expression, 'redistribution': request.redistribution}, 'source_revision': snapshot,
            'parent_import_id': parent['id'] if parent else None, 'parent_snapshot_sha256': parent['snapshot_sha256'] if parent else None}
        self.store.put('import', item['id'], item, project_id, immutable=True)
        return item

    def state(self, run_id, state, reason=None):
        with self.control:
            run = self.require('run', run_id)
            if run['state'] in TERMINAL: return run
            if state not in TRANSITIONS.get(run['state'], set()) | {'FAILED_INFRA', 'TIMED_OUT', 'CANCELLED', 'BLOCKED'}:
                raise DomainError('ILLEGAL_RUN_TRANSITION', f'{run["state"]} cannot transition to {state}', 409)
            run.update(state=state, reason=reason, updated_at=now())
            self.store.put('run', run_id, run, run['project_id'])
            self.store.append(run_id, 'job.state', {'state': state, 'reason': reason})
            return run

    def start_analysis(self, import_id, top):
        item = self.require('import', import_id)
        if sum(r['state'] not in TERMINAL for r in self.store.list('run')) >= 8:
            raise DomainError('QUEUE_QUOTA', 'At most eight analysis jobs may be queued', 429)
        run_id = identifier('run')
        manifest = {'schema_version': '1.0', 'kind': 'rtl_analysis', 'import_id': import_id, 'source_snapshot_sha256': item['snapshot_sha256'], 'top': top,
            'tool': 'pyslang', 'tool_version': version('pyslang'), 'worker_sha256': digest(Path(__file__).with_name('analysis_worker.py').read_bytes()), 'python_version': sys.version.split()[0], 'ai_policy': 'NO_AI', 'network_required': False,
            'limits': {'wall_time_s': 30, 'source_bytes': 4000000, 'max_instance_depth': 32}, 'parser_isolation': 'CHILD_PROCESS_NOT_OS_SANDBOX', 'simulation_executed': False}
        run = {'id': run_id, 'project_id': item['project_id'], 'import_id': import_id, 'kind': 'rtl_analysis', 'state': 'CREATED', 'created_at': now(), 'manifest': manifest,
            'manifest_sha256': digest(canonical(manifest).encode()), 'artifacts': [], 'result': None}
        self.store.put('run', run_id, run, item['project_id'], immutable=True)
        self.state(run_id, 'VALIDATING')
        self.store.append(run_id, 'build.log', {'message': f'Analyzing immutable snapshot {item["snapshot_sha256"][:16]} with pyslang {version("pyslang")}. No simulation is executed.'})
        self.state(run_id, 'QUEUED')
        self.pool.submit(self._analyze, run_id, item, top)
        return self.require('run', run_id)

    def _analyze(self, run_id, item, top):
        process = None
        work = self.store.root / 'work' / run_id
        work.mkdir(parents=True, exist_ok=True)
        try:
            with self.control:
                if self.require('run', run_id)['state'] == 'CANCELLED': return
                self.state(run_id, 'RUNNING')
                files = [{'path': f['path'], 'content': (self.store.blobs / f['sha256']).read_text(encoding='utf-8')} for f in item['files']]
                request_path = work / 'request.json'
                request_path.write_text(canonical({'files': files, 'top': top}), encoding='utf-8')
                # Explicit argv, no user code/imported build scripts executed, stderr retained.
                process = subprocess.Popen([sys.executable, '-m', 'apps.api.analysis_worker', str(request_path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                self.processes[run_id] = process
            try:
                stdout, stderr = process.communicate(timeout=30)
            except subprocess.TimeoutExpired:
                process.kill(); stdout, stderr = process.communicate()
                self.state(run_id, 'TIMED_OUT', 'PARSER_WALL_TIME_LIMIT')
                return
            if self.require('run', run_id)['state'] == 'CANCELLED': return
            if len(stdout) > 4_000_000 or len(stderr) > 1_000_000:
                self.state(run_id, 'FAILED_INFRA', 'PARSER_OUTPUT_LIMIT'); return
            if process.returncode:
                self.store.append(run_id, 'warning', {'message': stdout.decode(errors='replace')[:5000] + stderr.decode(errors='replace')[:5000]})
                self.state(run_id, 'FAILED_INFRA', 'PARSER_PROCESS_FAILED'); return
            self.state(run_id, 'COLLECTING')
            result = json.loads(stdout)
            sha = self.store.blob(stdout)
            artifact = {'id': sha, 'sha256': sha, 'kind': 'rtl-analysis', 'media_type': 'application/json', 'size': len(stdout), 'complete': True}
            with self.control:
                run = self.require('run', run_id)
                if run['state'] == 'CANCELLED': return
                run['result'], run['artifacts'] = result, [artifact]
                self.store.put('run', run_id, run, item['project_id'])
            self.store.append(run_id, 'artifact.ready', artifact)
            for d in result['diagnostics']:
                self.store.append(run_id, 'warning', d)
            with self.control:
                if self.require('run', run_id)['state'] in TERMINAL: return
                self.state(run_id, 'VERIFYING')
                self.store.append(run_id, 'build.log', {'message': f'Elaborated {len(result["hierarchy"])} top(s); {len(result["diagnostics"])} diagnostic(s). Evidence: EXTRACTED, simulation: NOT_EXECUTED.'})
                self.state(run_id, 'COMPLETED_PASS' if result['success'] else 'COMPLETED_FAIL')
                self.store.append(run_id, 'run.verdict', {'scope': 'RTL_ANALYSIS_ONLY', 'verdict': 'PASS' if result['success'] else 'FAIL', 'simulation_executed': False})
        except Exception as exc:
            self.store.append(run_id, 'warning', {'message': f'{type(exc).__name__}: {exc}'})
            self.state(run_id, 'FAILED_INFRA', 'WORKER_ERROR')
        finally:
            with self.control: self.processes.pop(run_id, None)

    def cancel(self, run_id):
        with self.control:
            run = self.require('run', run_id)
            if run['state'] in TERMINAL: return run
            self.state(run_id, 'CANCELLED', 'USER_CANCELLED')
            process = self.processes.get(run_id)
            if process and process.poll() is None: process.kill()
        return self.require('run', run_id)

    def draft(self, request):
        item = self.require('import', request.import_id)
        run = self.require('run', request.analysis_run_id)
        if run['import_id'] != item['id'] or run['state'] != 'COMPLETED_PASS':
            raise DomainError('ANALYSIS_REQUIRED', 'Package requires successful analysis of this exact source snapshot')
        package_id = ':'.join((request.namespace, request.library, request.name, request.version))
        if self.store.get('package', package_id): raise DomainError('IMMUTABLE_VERSION', 'Package version already exists; choose a new version', 409)
        p = {'id': package_id, 'project_id': item['project_id'], 'schema_version': '1.0', 'status': 'DRAFT', 'created_at': now(), 'source_snapshot_sha256': item['snapshot_sha256'], 'import_id': item['id'], 'files': item['files'], 'rights': item['rights'],
            'analysis_run_id': run['id'], 'analysis_artifact_sha256': run['artifacts'][0]['sha256'], 'knowledge_level': 'EXTRACTED', 'simulation_verified': False, 'capability': 'PIN_LEVEL', 'dependencies': [], 'hierarchy': run['result']['hierarchy']}
        # Lifecycle metadata may change; the content pin covers immutable package payload only.
        p['content_sha256'] = digest(canonical({k: v for k, v in p.items() if k not in {'status', 'created_at', 'project_id', 'id'}}).encode())
        self.store.put('package', p['id'], p, p['project_id'], immutable=True)
        return p

    def close(self):
        for run in self.store.list('run'):
            if run['state'] not in TERMINAL: self.cancel(run['id'])
        self.pool.shutdown(wait=True, cancel_futures=True)
        self.store.close()
