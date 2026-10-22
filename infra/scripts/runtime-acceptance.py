"""Actual HTTP/API-to-native-engine acceptance; no simulator mocking."""
import argparse
import json
import time
import xml.etree.ElementTree as ET
from pathlib import Path
import httpx

parser=argparse.ArgumentParser(); parser.add_argument('--profiles',nargs='+',default=['systemc_tlm','systemc_verilated','yosys_netlist','picorv32_icarus','picorv32_verilator','ibex_simple_system','gem5_riscv','gem5_tlm_roundtrip']); parser.add_argument('--negative',action='store_true'); parser.add_argument('--append',action='store_true');parser.add_argument('--collect-latest',action='store_true');parser.add_argument('--scenarios',nargs='+',choices=['baseline','backpressure','negative_control']);args=parser.parse_args()
root=Path(__file__).resolve().parents[2]; cases=[]
previous_path=root/'docs/test-evidence/runtime/api-acceptance.json'
old_report=json.loads(previous_path.read_text()) if previous_path.is_file() else {}
with httpx.Client(base_url='http://127.0.0.1:8000/api/v1',headers={'x-opensoc-client':'workbench'},timeout=40) as client:
    if args.collect_latest:
        response=client.get('/projects');response.raise_for_status();project=next(p for p in response.json() if p['name'].startswith('Engine runtime acceptance '))
        response=client.get('/runtime/runs',params={'project_id':project['id']});response.raise_for_status();existing=response.json()
    else:
        response=client.post('/projects',json={'name':'Engine runtime acceptance '+str(int(time.time()))}); response.raise_for_status(); project=response.json()
    for profile in args.profiles:
        for scenario in args.scenarios or (['baseline','negative_control'] if args.negative else ['baseline']):
            if args.collect_latest: run=next(r for r in existing if r['profile_id']==profile and r['scenario']==scenario)
            else:
                response=client.post('/runtime/runs',json={'project_id':project['id'],'profile_id':profile,'scenario':scenario})
                if response.status_code!=202:
                    cases.append({'profile':profile,'scenario':scenario,'status':'NOT_EXECUTED','error':response.text});print(cases[-1],flush=True);continue
                run=response.json()
            previous=''; start=time.monotonic()
            while run['state'] not in {'COMPLETED_PASS','COMPLETED_FAIL','FAILED_INFRA','TIMED_OUT','CANCELLED'}:
                if time.monotonic()-start>1200: raise TimeoutError(profile)
                response=client.get('/runtime/runs/'+run['id']);response.raise_for_status();run=response.json()
                state=' / '.join(s['id']+':'+s['state'] for s in run['stages'])
                if state!=previous: print(profile,scenario,state,flush=True);previous=state
                time.sleep(.4)
            result=run.get('result') or {}
            case={'profile':profile,'scenario':scenario,'status':run['state'],'project_id':project['id'],'run_id':run['id'],'result_file':run['output']+'/result.json','checks':result.get('checks'),'error':result.get('error') or run.get('reason')}
            # Exercise project/run artifact authorization and actual Wellen endpoint.
            waves=[(p,a) for p,a in result.get('artifacts',{}).items() if p.endswith(('.vcd','.fst'))]
            if run['state']=='COMPLETED_PASS' and waves and scenario=='baseline':
                wave=client.get(f'/runtime/runs/{run["id"]}/waveform/{waves[0][1]["sha256"]}',params={'start':'0','end':'2000000'})
                if wave.status_code!=200 or not wave.json().get('window'): case['status']='WAVE_API_FAIL';case['error']=wave.text[:1000]
                else: case['wellen_signals']=len(wave.json()['signals'])
            cases.append(case);print(profile,scenario,case['status'],case.get('error'),flush=True)
folder=root/'docs/test-evidence/runtime';folder.mkdir(exist_ok=True)
history=old_report.get('attempt_history',[])
if args.append:
    keys={(c['profile'],c['scenario']) for c in cases}
    history += [c for c in old_report.get('cases',[]) if (c['profile'],c['scenario']) in keys]
    cases = [c for c in old_report.get('cases',[]) if (c['profile'],c['scenario']) not in keys]+cases
else: history += old_report.get('cases',[])
(folder/'api-acceptance.json').write_text(json.dumps({'status':'PASS' if cases and all(c['status']=='COMPLETED_PASS' for c in cases) else 'FAIL','project':project,'cases':cases,'attempt_history':history},indent=2)+'\n')
suite=ET.Element('testsuite',name='Actual engine HTTP workflows',tests=str(len(cases)),failures=str(sum(c['status']!='COMPLETED_PASS' for c in cases)))
for case in cases:
    node=ET.SubElement(suite,'testcase',name=case['profile']+'_'+case['scenario'])
    if case['status']!='COMPLETED_PASS': ET.SubElement(node,'failure').text=json.dumps(case)
ET.ElementTree(suite).write(folder/'api-acceptance.xml',encoding='utf-8',xml_declaration=True)
raise SystemExit(0 if all(c['status']=='COMPLETED_PASS' for c in cases) else 1)
