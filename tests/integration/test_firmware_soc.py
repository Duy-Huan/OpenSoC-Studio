import base64
import copy
import struct
import json
from pathlib import Path
from jsonschema import Draft202012Validator
import pytest
from fastapi.testclient import TestClient
from apps.api.main import create_app
from apps.api.firmware import inspect_elf
from apps.api.domain import DomainError, validate_soc
from apps.api.models import SoCConfig
from tests.integration.test_api import HEADERS, project, imported, analyzed


def elf32(entry=0x100080, machine=243, address=0x100000, flags=0):
    # Synthetic parser fixture, NOT compiled firmware or CPU execution evidence.
    ident = b'\x7fELF' + bytes([1, 1, 1, 0]) + bytes(8)
    header = struct.pack('<HHIIIIIHHHHHH', 2, machine, 1, entry, 52, 0, flags, 52, 32, 1, 0, 0, 0)
    segment = struct.pack('<IIIIIIII', 1, 0x100, address, address, 4, 0x100, 5, 0x100)
    return (ident+header+segment).ljust(0x100, b'\0') + b'\x13\x00\x00\x00'


def test_structural_elf_validation_is_not_boot_verification():
    result = inspect_elf(elf32())
    assert result['entry'] == '0x100080' and result['compatibility'] == 'STRUCTURAL_CHECKS_PASSED'
    assert result['boot_verified'] is False and result['simulation_executed'] is False


@pytest.mark.parametrize('data,code', [(b'no elf', 'ELF_MAGIC_INVALID'), (elf32()[:30], 'ELF_TRUNCATED'), (elf32(machine=62), 'FIRMWARE_ISA_MISMATCH'), (elf32(address=0x40000000), 'FIRMWARE_MEMORY_CONFLICT'), (elf32(entry=0x100084), 'FIRMWARE_BOOT_CONFLICT'), (elf32(flags=4), 'FIRMWARE_ABI_MISMATCH'), (elf32()[:-2], 'ELF_SEGMENT_TRUNCATED')])
def test_incompatible_firmware_rejected(data, code):
    with pytest.raises(DomainError) as error: inspect_elf(data)
    assert error.value.code == code


def test_firmware_api_retains_hash_and_rejects_bad_image(tmp_path):
    with TestClient(create_app(tmp_path), headers=HEADERS) as c:
        p = project(c)
        body = {'project_id': p['id'], 'filename': 'synthetic-fixture.elf', 'content_base64': base64.b64encode(elf32()).decode()}
        r = c.post('/api/v1/firmware/import', json=body)
        assert r.status_code == 201 and len(r.json()['artifact_sha256']) == 64
        assert c.get(f'/api/v1/projects/{p["id"]}/firmware').json()[0]['boot_verified'] is False
        body['content_base64'] = 'invalid???'
        assert c.post('/api/v1/firmware/import', json=body).json()['code'] == 'FIRMWARE_ENCODING_INVALID'


def topology(p, package):
    bus = {'id': 'bus', 'protocol': 'AXI4-Lite', 'role': 'initiator', 'data_width': 32, 'address_width': 32, 'clock_domain': 'core'}
    target = {**bus, 'role': 'target'}
    return {'id': f'soc-{p["id"]}', 'project_id': p['id'], 'revision': 0, 'instances': [{'id': 'master', 'ip_id': package, 'interfaces': [bus]}, {'id': 'target', 'ip_id': package, 'interfaces': [target]}],
      'address_regions': [{'id': 'r0', 'instance_id': 'target', 'base': '0x1000', 'size': '0x1000', 'alignment': '0x4'}],
      'connections': [{'id': 'c0', 'from': {'instance_id': 'master', 'interface_id': 'bus'}, 'to': {'instance_id': 'target', 'interface_id': 'bus'}, 'adapter_contract': 'direct_v1'}], 'clocks': [{'id': 'core', 'frequency_hz': 100000000}]}


def test_two_topologies_etag_and_invalid_commit(tmp_path):
    with TestClient(create_app(tmp_path), headers=HEADERS) as c:
        p = project(c); item = imported(c, p); run = analyzed(c, item)
        package = c.post('/api/v1/ip-packages', json={'import_id': item['id'], 'analysis_run_id': run['id'], 'namespace': 'test', 'name': 'regs'}).json()['id']
        body = topology(p, package); path = f'/api/v1/soc-configs/{body["id"]}'
        a = c.patch(path, json=body, headers={'If-Match': '0'})
        assert a.status_code == 200 and a.json()['revision'] == 1
        assert c.patch(path, json=body, headers={'If-Match': '0'}).status_code == 409
        b = a.json(); b['address_regions'][0]['base'] = '0x40000000'
        saved = c.patch(path, json=b, headers={'If-Match': '1'})
        assert saved.status_code == 200 and saved.json()['revision'] == 2
        bad = saved.json(); bad['address_regions'].append({**bad['address_regions'][0], 'id': 'r1'})
        failure = c.patch(path, json=bad, headers={'If-Match': '2'})
        assert failure.status_code == 422 and any(e['code'] == 'ADDRESS_OVERLAP' for e in failure.json()['details'])
        current = c.get(f'/api/v1/projects/{p["id"]}/soc-config').json()
        assert current['revision'] == 2 and len(current['address_regions']) == 1


@pytest.mark.parametrize('kind,code', [('role', 'ROLE_MISMATCH'), ('width', 'BUS_MISMATCH'), ('clock', 'CLOCK_DOMAIN_MISMATCH'), ('overflow', 'ADDRESS_OVERFLOW')])
def test_bus_and_range_invariants(kind, code):
    body = topology({'id': 'p'}, 'fixture:rtl:test:1.0.0')
    if kind == 'role': body['instances'][1]['interfaces'][0]['role'] = 'initiator'
    elif kind == 'width': body['instances'][1]['interfaces'][0]['data_width'] = 64
    elif kind == 'clock': body['instances'][1]['interfaces'][0]['clock_domain'] = 'other'
    elif kind == 'overflow': body['address_regions'][0].update(base='0xfffff000', size='0x2000')
    assert any(e['code'] == code for e in validate_soc(SoCConfig.model_validate(body)))


def test_actual_soc_model_matches_shared_draft_schema():
    schema = json.loads((Path(__file__).resolve().parents[2]/'docs/contracts/soc-config.schema.json').read_text())
    Draft202012Validator(schema).validate(SoCConfig(id='soc-test', project_id='test', revision=0).model_dump(by_alias=True))
    value = SoCConfig.model_validate(topology({'id': 'test'}, 'fixture:rtl:test:1.0.0')).model_dump(by_alias=True)
    Draft202012Validator(schema).validate(value)
