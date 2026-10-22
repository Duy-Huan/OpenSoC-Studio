"""Read-only evidence access for the explicitly executed, fixed reference regression."""
import hashlib
import json
from pathlib import Path
from .domain import DomainError


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def evidence(root: Path):
    path = root/'docs/test-evidence/real-soc/regression.json'
    if not path.is_file():
        raise DomainError('REFERENCE_NOT_EXECUTED', 'Run npm run sim:reference to generate actual RTL evidence.', 424)
    raw = path.read_bytes()
    result = json.loads(raw)
    result['evidence_id'] = hashlib.sha256(raw).hexdigest()
    downloads = dict(result['artifacts'])
    for command in result['commands']:
        for key in ['stdout', 'stderr']:
            downloads[command[key]] = {'sha256': command[key+'_sha256']}
    result['downloads'] = downloads
    return result


def artifact(root: Path, evidence_id: str, artifact_id: str):
    report = evidence(root)
    if evidence_id != report['evidence_id']:
        raise DomainError('EVIDENCE_CHANGED', 'Latest reference evidence changed; refresh before downloading.', 409)
    for name, metadata in report['downloads'].items():
        if metadata['sha256'] != artifact_id: continue
        path = (root/name).resolve()
        if not path.is_relative_to((root/'artifacts/real-soc').resolve()):
            raise DomainError('UNSAFE_ARTIFACT', 'Artifact path escapes the reference output boundary.', 403)
        if not path.is_file(): raise DomainError('ARTIFACT_MISSING', 'Local reference artifact is missing; rerun the regression.', 404)
        if sha(path) != artifact_id: raise DomainError('ARTIFACT_CHANGED', 'Artifact hash no longer matches recorded execution.', 409)
        return path
    raise DomainError('NOT_FOUND', 'Artifact not listed in reference evidence.', 404)
