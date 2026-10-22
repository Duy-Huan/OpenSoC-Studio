"""Exercise API cancellation acknowledgement and monotonic persisted native events."""
import json
import time
from pathlib import Path
import httpx

root=Path(__file__).resolve().parents[2]
with httpx.Client(base_url='http://127.0.0.1:8000/api/v1',headers={'x-opensoc-client':'workbench'},timeout=20) as client:
    response=client.post('/projects',json={'name':'Runtime cancellation acceptance'});response.raise_for_status();project=response.json()
    response=client.post('/runtime/runs',json={'project_id':project['id'],'profile_id':'systemc_tlm'});response.raise_for_status();run=response.json()
    deadline=time.monotonic()+120
    while run['state']=='QUEUED':
        if time.monotonic()>deadline: raise TimeoutError('Native queue did not advance')
        time.sleep(.1);run=client.get('/runtime/runs/'+run['id']).json()
    response=client.post('/runtime/runs/'+run['id']+'/cancel');response.raise_for_status()
    print('API cancel requested:',response.json()['state'],flush=True)
    while run['state'] not in {'CANCELLED','COMPLETED_PASS','COMPLETED_FAIL','FAILED_INFRA','TIMED_OUT'}:
        if time.monotonic()>deadline: raise TimeoutError('Cancellation not acknowledged')
        time.sleep(.1);run=client.get('/runtime/runs/'+run['id']).json()
    assert run['state']=='CANCELLED',run
    events=client.get('/runtime/runs/'+run['id']+'/events').json()
    assert [e['seq'] for e in events]==list(range(1,len(events)+1))
    assert client.get('/runtime/runs/'+run['id']+'/events',params={'after_seq':2}).json()==events[2:]
    assert not any(e['kind']=='run.verdict' and e['data'].get('status')=='PASS' for e in events)
    result={'status':'PASS','run_id':run['id'],'checks':['running native job cancelled and acknowledged','no successful verdict after cancellation','monotonic persisted event sequences','event replay after sequence matches'],'state':run['state'],'events':events}
    (root/'docs/test-evidence/runtime/http-controls.json').write_text(json.dumps(result,indent=2)+'\n')
    print('Actual API cancellation/event replay: PASS',flush=True)
