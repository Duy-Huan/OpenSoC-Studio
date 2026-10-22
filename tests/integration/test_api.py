import io
import json
import stat
import threading
import time
import zipfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from apps.api.main import create_app
from apps.api.services import TERMINAL

HEADERS = {'x-opensoc-client': 'workbench'}
RTL = '''module child(input logic [7:0] data_i, output logic [7:0] data_o);
assign data_o = data_i;
endmodule
module top(input logic clk_i, input logic [7:0] data_i, output logic [7:0] data_o);
child u_child(data_i, data_o);
endmodule
'''


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / 'data'), headers=HEADERS) as c:
        yield c


def project(c, name='Test SoC'):
    r = c.post('/api/v1/projects', json={'name': name}); assert r.status_code == 201, r.text
    return r.json()


def imported(c, p=None, text=RTL):
    p = p or project(c)
    r = c.post(f'/api/v1/projects/{p["id"]}/rtl-imports', json={'files': [{'path': 'rtl/top.sv', 'content': text}], 'license_expression': 'MIT', 'redistribution': 'allowed'})
    assert r.status_code == 201, r.text
    return r.json()


def analyzed(c, item, top=None):
    r = c.post(f'/api/v1/rtl-imports/{item["id"]}/analyze', json={'top': top})
    assert r.status_code == 202, r.text
    run_id = r.json()['id']
    for _ in range(250):
        run = c.get(f'/api/v1/runs/{run_id}').json()
        if run['state'] in TERMINAL: return run
        time.sleep(0.02)
    pytest.fail('Actual parser worker did not finish')


def test_real_parser_hierarchy_ports_and_artifact(client):
    item = imported(client)
    run = analyzed(client, item, 'top')
    assert run['state'] == 'COMPLETED_PASS', run
    result = run['result']; top = result['hierarchy'][0]
    assert top['module'] == 'top'
    assert top['children'][0]['id'] == 'top.u_child'
    assert top['ports'][1]['width'] == 8
    assert top['ports'][0]['direction'] == 'input'
    assert top['source']['file'] == 'rtl/top.sv'
    assert result['simulation_executed'] is False
    r = client.get(f'/api/v1/runs/{run["id"]}/artifacts/{run["artifacts"][0]["id"]}')
    assert r.status_code == 200 and r.json()['tool'] == 'pyslang'


def test_invalid_top_is_actual_diagnostic(client):
    run = analyzed(client, imported(client), 'absent_top')
    assert run['state'] == 'COMPLETED_FAIL', run
    assert any(d['severity'] == 'error' and 'absent_top' in d['message'] for d in run['result']['diagnostics'])


def test_invalid_rtl_has_exact_source_location(client):
    run = analyzed(client, imported(client, text='module broken(input logic a); assign q = unknown_name; endmodule'))
    assert run['state'] == 'COMPLETED_FAIL', run
    assert any(d['file'] == 'rtl/top.sv' and d['line'] == 1 and d['column'] > 0 for d in run['result']['diagnostics'] if d['severity'] == 'error')


@pytest.mark.parametrize('path', ['../escape.sv', '/absolute.sv', 'C:/escape.sv', 'rtl\\bad.sv', 'rtl/CON.sv', 'rtl/bad .sv/../x.sv', 'rtl/a.sv:stream', 'rtl/a.sv.'])
def test_source_path_guards(client, path):
    p = project(client)
    r = client.post(f'/api/v1/projects/{p["id"]}/rtl-imports', json={'files': [{'path': path, 'content': RTL}]})
    assert r.status_code == 422 and r.json()['code'] == 'UNSAFE_SOURCE_PATH'


def test_case_collision(client):
    p = project(client)
    r = client.post(f'/api/v1/projects/{p["id"]}/rtl-imports', json={'files': [{'path': 'top.sv', 'content': RTL}, {'path': 'TOP.sv', 'content': RTL}]})
    assert r.status_code == 422 and r.json()['code'] == 'SOURCE_COLLISION'


def test_include_cannot_read_host(client):
    p = project(client)
    r = client.post(f'/api/v1/projects/{p["id"]}/rtl-imports', json={'files': [{'path': 'top.sv', 'content': '/*prefix*/ `include "/etc/passwd"\n'+RTL}]})
    assert r.status_code == 422


def test_zip_slip_and_symlink(client):
    p = project(client)
    for name, mode in [('../escape.sv', None), ('link.sv', stat.S_IFLNK | 0o777)]:
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as z:
            entry = zipfile.ZipInfo(name)
            if mode: entry.external_attr = mode << 16
            z.writestr(entry, RTL)
        r = client.post(f'/api/v1/projects/{p["id"]}/rtl-archives', content=output.getvalue())
        assert r.status_code == 422


def test_valid_archive(client):
    p = project(client); output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as z: z.writestr('rtl/top.sv', RTL)
    r = client.post(f'/api/v1/projects/{p["id"]}/rtl-archives', content=output.getvalue())
    assert r.status_code == 201 and len(r.json()['files']) == 1


def test_source_snapshot_is_immutable(client):
    p = project(client); a = imported(client, p); b = imported(client, p, text=RTL.replace('[7:0]', '[15:0]'))
    assert a['snapshot_sha256'] != b['snapshot_sha256']
    src = client.get(f'/api/v1/rtl-imports/{a["id"]}/sources/{a["files"][0]["id"]}').json()
    assert src['content'] == RTL


def test_derived_snapshot_retains_parent_provenance(client):
    p = project(client); original = imported(client, p)
    changed = client.post(f'/api/v1/projects/{p["id"]}/rtl-imports', json={'parent_import_id': original['id'], 'files': [{'path': 'rtl/top.sv', 'content': RTL+'\n// user edit'}]}).json()
    assert changed['parent_import_id'] == original['id']
    assert changed['parent_snapshot_sha256'] == original['snapshot_sha256']
    assert changed['snapshot_sha256'] != original['snapshot_sha256']


def test_ordered_fileset_is_part_of_snapshot_identity(client):
    p = project(client)
    files = [{'path': 'a.sv', 'content': 'module a; endmodule'}, {'path': 'b.sv', 'content': 'module b; endmodule'}]
    url = f'/api/v1/projects/{p["id"]}/rtl-imports'
    first = client.post(url, json={'files': files}).json()
    reordered = client.post(url, json={'files': list(reversed(files))}).json()
    assert first['snapshot_sha256'] != reordered['snapshot_sha256']


def test_analysis_replay_matches_pinned_output(client):
    item = imported(client)
    first, replay = analyzed(client, item, 'top'), analyzed(client, item, 'top')
    assert first['state'] == replay['state'] == 'COMPLETED_PASS'
    assert first['manifest_sha256'] == replay['manifest_sha256']
    assert first['artifacts'][0]['sha256'] == replay['artifacts'][0]['sha256']
    assert len(first['manifest']['worker_sha256']) == 64


def test_ws_replay_has_monotonic_sequences(client):
    run = analyzed(client, imported(client))
    events = client.get(f'/api/v1/runs/{run["id"]}/events').json()
    assert [e['seq'] for e in events] == list(range(1, len(events)+1))
    with client.websocket_connect(f'/api/v1/runs/{run["id"]}/stream?after_seq=3') as ws:
        replay = [ws.receive_json() for _ in events[3:]]
    assert replay == events[3:]


def test_queued_job_cancel_does_not_emit_pass(client):
    blocker = threading.Event()
    client.app.state.studio.pool.submit(blocker.wait, 5)
    try:
        item = imported(client)
        run = client.post(f'/api/v1/rtl-imports/{item["id"]}/analyze', json={}).json()
        assert client.post(f'/api/v1/runs/{run["id"]}/cancel').json()['state'] == 'CANCELLED'
    finally: blocker.set()
    events = client.get(f'/api/v1/runs/{run["id"]}/events').json()
    assert not any(e['kind'] == 'run.verdict' and e['data'].get('verdict') == 'PASS' for e in events)


def test_persistence_and_workspace_conflict(tmp_path):
    root = tmp_path / 'data'
    with TestClient(create_app(root), headers=HEADERS) as c:
        p = project(c)
        url = f'/api/v1/projects/{p["id"]}/workspace'
        assert c.put(url, json={'revision': 0, 'layout': {'active_file': 'rtl/top.sv'}}).status_code == 200
        assert c.put(url, json={'revision': 0, 'layout': {}}).status_code == 409
    with TestClient(create_app(root), headers=HEADERS) as c:
        assert c.get('/api/v1/projects').json()[0]['id'] == p['id']
        assert c.get(url).json()['layout']['active_file'] == 'rtl/top.sv'


def test_registry_review_reuse_immutable_and_publish_gate(client):
    item = imported(client); run = analyzed(client, item)
    body = {'import_id': item['id'], 'analysis_run_id': run['id'], 'namespace': 'test', 'name': 'block'}
    r = client.post('/api/v1/ip-packages', json=body); assert r.status_code == 201, r.text
    p = r.json(); assert p['simulation_verified'] is False
    assert client.post('/api/v1/ip-packages', json=body).status_code == 409
    assert client.post(f'/api/v1/ip-packages/{p["id"]}/publish').status_code == 424
    reviewed = client.post(f'/api/v1/ip-packages/{p["id"]}/review', json={'reviewer': 'Local test reviewer', 'acknowledge_unverified': True})
    assert reviewed.status_code == 200 and reviewed.json()['status'] == 'REVIEWED'
    target = project(client, 'Second project')
    r = client.post(f'/api/v1/ip-packages/{p["id"]}/reuse', json={'project_id': target['id'], 'acknowledge_unverified': True})
    assert r.status_code == 200 and r.json()['content_sha256'] == p['content_sha256']


def test_simulation_is_explicitly_unavailable(client):
    p = project(client)
    for lane in ['rtl_standalone', 'rtl_cpu_soc', 'gem5_arch', 'gem5_hybrid']:
        r = client.post('/api/v1/runs', json={'project_id': p['id'], 'lane': lane})
        assert r.status_code == 424 and r.json()['code'] == 'SIMULATION_WORKER_UNAVAILABLE'
    assert client.get(f'/api/v1/projects/{p["id"]}/runs').json() == []


def test_local_origin_and_csrf_guard(client):
    assert client.post('/api/v1/projects', json={'name': 'bad'}, headers={'origin': 'https://evil.example'}).status_code == 403
    with TestClient(create_app(client.app.state.studio.store.root / 'other')) as c:
        assert c.post('/api/v1/projects', json={'name': 'bad'}).status_code == 403
    assert client.get('/api/v1/health', headers={'host': 'evil.example'}).status_code == 403


def test_contract_and_error_shape(client):
    r = client.post('/api/v1/projects', json={'name': 'test', 'shell': 'anything'})
    assert r.status_code == 422
    assert set(r.json()) == {'code', 'message', 'details', 'correlation_id'}
    assert client.get('/api/v1/health').json()['ai_policy'] == 'NO_AI'
