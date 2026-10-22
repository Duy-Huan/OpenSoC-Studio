import hashlib
import json
import pytest
from fastapi.testclient import TestClient
from apps.api.main import create_app
from workers.reference_soc.oracles import arithmetic, check_uart


@pytest.mark.parametrize('a,b,mul,div', [
    (0, 0, [0,0,0,0], [0xffffffff,0xffffffff,0,0]),
    (0x80000000, 0xffffffff, [0x80000000,0,0x80000000,0x7fffffff], [0x80000000,0,0,0x80000000]),
    (0xfffffff9, 3, [0xffffffeb,0xffffffff,0xffffffff,2], [0xfffffffe,0x55555553,0xffffffff,0]),
    (7, 0xfffffffd, [0xffffffeb,0xffffffff,6,6], [0xfffffffe,0,1,7]),
])
def test_host_oracle_signed_unsigned_edges(a, b, mul, div):
    assert arithmetic(a, b) == (mul, div)


def test_uart_oracle_rejects_missing_and_mutated_arithmetic():
    # Captured output from the actual upstream run, kept as evidence in the repo.
    from pathlib import Path
    log = Path('docs/test-evidence/real-soc/logs/baseline.stdout.log')
    if not log.is_file(): pytest.skip('Native reference evidence has not been generated')
    text = log.read_text()
    names = check_uart(text, [])['assembly_names']
    assert len(names) == 45
    result = check_uart(text, names)
    assert all(result[k] for k in ['assembly_complete', 'prime_values_correct', 'independent_arithmetic_correct', 'interrupts_observed'])
    assert not check_uart(text.replace('80000000  00000000', '80000001  00000000', 1), names)['independent_arithmetic_correct']
    assert not check_uart(text.replace('31st prime is 127.', '31st prime is 129.'), names)['prime_values_correct']
    assert not check_uart(text.replace('lui..OK', 'lui..FAIL'), names)['assembly_complete']


def test_reference_artifact_access_boundary_and_hash(tmp_path):
    folder = tmp_path/'docs/test-evidence/real-soc'; folder.mkdir(parents=True)
    output = tmp_path/'artifacts/real-soc/run/wave.vcd'; output.parent.mkdir(parents=True)
    output.write_bytes(b'$timescale 1ns $end\n')
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    report = {'artifacts': {str(output.relative_to(tmp_path)): {'sha256': digest}}, 'commands': []}
    with TestClient(create_app(tmp_path/'data', reference_root=tmp_path)) as c:
        assert c.get('/api/v1/reference-regression').status_code == 424
        (folder/'regression.json').write_text(json.dumps(report))
        evidence_id = c.get('/api/v1/reference-regression').json()['evidence_id']
        url = f'/api/v1/reference-regression/{evidence_id}/artifacts/{digest}'
        assert c.get(url).content == output.read_bytes()
        assert c.get(url.replace(evidence_id, 'stale')).status_code == 409
        output.write_bytes(b'changed')
        assert c.get(url).status_code == 409
        report['artifacts'] = {'../../outside': {'sha256': digest}}
        (folder/'regression.json').write_text(json.dumps(report))
        evidence_id = c.get('/api/v1/reference-regression').json()['evidence_id']
        assert c.get(f'/api/v1/reference-regression/{evidence_id}/artifacts/{digest}').status_code == 403
