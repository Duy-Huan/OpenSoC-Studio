"""Record installed Python wheel pins, license evidence and separate runtime/test scopes."""
import hashlib
import importlib.metadata as metadata
import json
import re
from pathlib import Path
from packaging.requirements import Requirement

root = Path(__file__).resolve().parents[2]
report = json.loads((root/'.tools/python-install.json').read_text(encoding='utf-8'))
installs = report['install']
if not installs:
    saved = json.loads((root/'docs/test-evidence/current/python-licenses.json').read_text(encoding='utf-8'))
    installs = [{'metadata': {'name': c['name'], 'version': c['version']}, 'download_info': {'url': c['wheel_url'], 'archive_info': {'hashes': {'sha256': c['wheel_sha256']}}}} for c in saved['components']]
pins = sorted((i['metadata']['name'], i['metadata']['version'], i['download_info']['archive_info']['hashes']['sha256']) for i in installs)
(root/'apps/api/requirements.lock').write_text('\n'.join(f'{n}=={v}' for n, v, _ in pins)+'\n', encoding='utf-8')
(root/'apps/api/requirements.windows.lock').write_text('# Windows CPython 3.12 wheel hashes; use requirements.lock for other platforms.\n'+'\n'.join(f'{n}=={v} --hash=sha256:{h}' for n, v, h in pins)+'\n', encoding='utf-8')
normalize = lambda name: name.lower().replace('_', '-')
by_name = {normalize(d.metadata['Name']): d for d in metadata.distributions()}
runtime = set()
def visit(name):
    name = normalize(name)
    if name in runtime or name not in by_name: return
    runtime.add(name)
    for requirement in by_name[name].requires or []:
        req = Requirement(requirement)
        if req.marker is None or req.marker.evaluate({'extra': ''}): visit(req.name)
for name in ['fastapi', 'pyslang', 'uvicorn', 'websockets']: visit(name)
evidence_dir = root/'docs/compliance/python-license-evidence'
evidence_dir.mkdir(parents=True, exist_ok=True)
components, notices = [], []
for item in installs:
    name, version = item['metadata']['name'], item['metadata']['version']
    dist = by_name[normalize(name)]
    if dist.version != version: raise RuntimeError(f'Installed version differs from audit pin: {name}')
    expression = dist.metadata.get('License-Expression')
    classifiers = dist.metadata.get_all('Classifier') or []
    if not expression:
        for label, spdx in [('MIT License', 'MIT'), ('Apache Software License', 'Apache-2.0'), ('BSD License', 'BSD-3-Clause'), ('Mozilla Public License 2.0', 'MPL-2.0')]:
            if any(label in value for value in classifiers): expression = spdx; break
    files = []
    for file in dist.files or []:
        if re.match(r'^(LICEN[CS]E|COPYING|NOTICE)([.-]|$)', Path(str(file)).name, re.I):
            path = Path(dist.locate_file(file))
            if not path.is_file(): continue
            data = path.read_bytes()
            target = evidence_dir/f'{name}-{len(files)}.txt'
            target.write_bytes(data)
            files.append({'file': str(target.relative_to(root)).replace('\\', '/'), 'sha256': hashlib.sha256(data).hexdigest()})
            notices.append(f'## {name} {version}\n\n{data.decode("utf-8", errors="replace")}')
    legacy = dist.metadata.get('License') or ''
    if not expression and 'Permission is hereby granted, free of charge' in legacy: expression = 'MIT'
    if not files and legacy:
        target = evidence_dir/f'{name}-metadata.txt'; target.write_text(legacy, encoding='utf-8')
        files.append({'file': str(target.relative_to(root)).replace('\\', '/'), 'sha256': hashlib.sha256(legacy.encode()).hexdigest(), 'source': 'wheel METADATA License field'})
        notices.append(f'## {name} {version} — metadata license\n\n{legacy}')
    expression = expression or 'NOASSERTION'
    decision = 'PREFERRED' if expression in {'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC'} and files else 'REVIEW_REQUIRED'
    component = {'name': name, 'version': version, 'scope': 'runtime' if normalize(name) in runtime else 'development', 'license_expression': expression, 'decision': decision, 'license_evidence': files,
      'wheel_url': item['download_info']['url'], 'wheel_sha256': item['download_info']['archive_info']['hashes']['sha256']}
    components.append(component)
    print(f'{name} {version}: {expression} {component["scope"]} {decision}')
python_license = root/'.tools/python/LICENSE.txt'
if python_license.exists(): (evidence_dir/'python-3.12.10.txt').write_bytes(python_license.read_bytes())
out = root/'docs/test-evidence/current'; out.mkdir(parents=True, exist_ok=True)
result = {'scope': 'Windows portable CPython installed wheel metadata/text audit; no full legal/per-file/OS/toolchain release approval', 'python_version': '3.12.10', 'python_license': 'PSF-2.0 plus bundled third-party terms; see python-3.12.10.txt', 'status': 'REVIEW_REQUIRED' if any(c['decision'] != 'PREFERRED' for c in components) else 'PASS_METADATA_ONLY', 'components': components}
(out/'python-licenses.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
(root/'sbom/python-windows.cdx.json').write_text(json.dumps({'bomFormat': 'CycloneDX', 'specVersion': '1.5', 'version': 1, 'components': [{'type': 'library', 'name': c['name'], 'version': c['version'], 'purl': f'pkg:pypi/{normalize(c["name"])}@{c["version"]}', 'hashes': [{'alg': 'SHA-256', 'content': c['wheel_sha256']}], 'licenses': [{'expression': c['license_expression']}] if c['license_expression'] != 'NOASSERTION' else []} for c in components]}, indent=2)+'\n', encoding='utf-8')
(root/'PYTHON_THIRD_PARTY_NOTICES.md').write_text('# Python dependency license evidence\n\nMetadata/text audit only. Runtime and development scopes are recorded in docs/test-evidence/current/python-licenses.json. No full release approval.\n\n'+'\n\n'.join(notices), encoding='utf-8')
