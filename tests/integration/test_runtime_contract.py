import pytest
from fastapi.testclient import TestClient
from apps.api.main import create_app

def test_runtime_rejects_arbitrary_commands_profiles_and_invalid_times(tmp_path):
    with TestClient(create_app(tmp_path/'data'),headers={'x-opensoc-client':'workbench'}) as client:
        project=client.post('/api/v1/projects',json={'name':'Runtime contract'}).json()
        body={'project_id':project['id'],'profile_id':'systemc_tlm'}
        for extra in [{'command':'whoami'},{'source_path':'C:/outside'},{'profile_id':'arbitrary_rtl'},{'scenario':'execute_shell'}]:
            assert client.post('/api/v1/runtime/runs',json={**body,**extra}).status_code==422
        assert client.post('/api/v1/runtime/runs',json={**body,'project_id':'missing'}).status_code==404
        assert client.get('/api/v1/runtime/runs?project_id=missing').status_code==404
        runtime=client.app.state.runtime
        from apps.api.domain import DomainError
        for start,end in [('-1','2'),('1.5','2'),('2','1'),('1e3','2000')]:
            with pytest.raises(DomainError): runtime.waveform('missing','missing',start,end,'')
        with pytest.raises(DomainError): runtime.waveform('missing','missing','0','100','../../escape')


def test_runtime_unprepared_is_explicit_and_artifacts_are_run_scoped(tmp_path,monkeypatch):
    import apps.api.runtime as module
    import hashlib
    monkeypatch.setattr(module,'ROOT',tmp_path)
    with TestClient(create_app(tmp_path/'data'),headers={'x-opensoc-client':'workbench'}) as client:
        project=client.post('/api/v1/projects',json={'name':'Runtime boundaries'}).json()
        response=client.post('/api/v1/runtime/runs',json={'project_id':project['id'],'profile_id':'systemc_tlm'})
        assert response.status_code==424 and response.json()['code']=='RUNTIME_UNAVAILABLE'
        assert client.get('/api/v1/runtime/runs',params={'project_id':project['id']}).json()==[]
        output=tmp_path/'artifacts/runtime/test-run';output.mkdir(parents=True)
        file=output/'signal.vcd';file.write_bytes(b'actual recorded bytes')
        digest=hashlib.sha256(file.read_bytes()).hexdigest()
        run={'id':'test-run','project_id':project['id'],'state':'COMPLETED_PASS','output':'artifacts/runtime/test-run','result':{'artifacts':{'artifacts/runtime/test-run/signal.vcd':{'sha256':digest}}}}
        client.app.state.studio.store.put('runtime-run','test-run',run,project['id'])
        url=f'/api/v1/runtime/runs/test-run/artifacts/{digest}'
        assert client.get(url).content==file.read_bytes()
        assert client.get(url.replace(digest,'unlisted')).status_code==404
        file.write_bytes(b'mutated')
        assert client.get(url).status_code==409
        run['result']['artifacts']={'../outside':{'sha256':digest}}
        client.app.state.studio.store.put('runtime-run','test-run',run,project['id'])
        assert client.get(url).status_code==403
