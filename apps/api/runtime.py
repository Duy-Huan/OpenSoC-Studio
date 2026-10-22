"""Project-scoped asynchronous fixed-profile workflows and real trace windows."""
import json
import os
import re
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from .domain import DomainError
from .services import identifier, now, TERMINAL
from .reference import sha

ROOT=Path(__file__).resolve().parents[2]
PROFILES={
 'picorv32_icarus': 'RISC-V GCC → Icarus → CPU firmware oracle → Wellen',
 'picorv32_verilator': 'RISC-V GCC → Verilator C++ build → CPU firmware oracle → Wellen',
 'systemc_tlm': 'G++/SystemC → synthetic TLM memory → transaction oracle',
 'systemc_verilated': 'Verilator SystemC build → TLM to actual RTL register → paired transaction oracle',
 'yosys_netlist': 'Yosys synthesis → RTL/netlist simulation comparison → Wellen',
 'gem5_riscv': 'RISC-V GCC → gem5 architecture CPU → workload/stats oracle',
 'gem5_tlm_roundtrip': 'gem5 RISC-V CPU → internal SystemC TLM bridges → memory → paired monitor oracle',
 'ibex_simple_system': 'FuseSoC/Edalize → Verilator Ibex → firmware → waveform',
}

def linux_path(path):
    value=Path(path).resolve().as_posix()
    return '/mnt/'+value[0].lower()+value[2:] if os.name=='nt' else value

def launcher(module, args):
    command=['/opt/opensoc/venv/bin/python','-m',module,*args]
    return ['wsl.exe','-d','OpenSoC-Runtime','-u','opensoc','--cd',linux_path(ROOT),'--',*command] if os.name=='nt' else command


class Runtime:
    def __init__(self, studio):
        self.studio=studio; self.store=studio.store; self.lock=threading.RLock()
        self.pool=ThreadPoolExecutor(max_workers=1,thread_name_prefix='engine-runtime')
        for run in self.store.list('runtime-run'):
            if run['state'] not in TERMINAL:
                (ROOT/run['output']/'cancel.request').touch()
                self.update(run['id'],'FAILED_INFRA',reason='SERVER_RESTARTED')

    def capabilities(self):
        marker=ROOT/'.tools/runtime-ready.json'
        tools=json.loads(marker.read_text()) if marker.is_file() else None
        profiles=[]
        for profile,description in PROFILES.items():
            available=bool(tools) and (not profile.startswith('gem5_') or tools['tools']['gem5']['available']) and (profile!='ibex_simple_system' or tools['tools'].get('ibex',{}).get('available',False))
            profiles.append({'id':profile,'description':description,'available':available,'status':'EXPERIMENTAL' if available else 'UNAVAILABLE','reason':None if available else 'Engine build/acceptance pending; prepare the dedicated Linux runtime.'})
        return {'schema_version':'1.0','profiles':profiles,'toolchain':tools,'isolation':'Fixed reviewed sources only; WSL resource limits are not a complete OS/network sandbox.'}

    def require(self, run_id): return self.studio.require('runtime-run',run_id)

    def update(self, run_id, state, **changes):
        with self.lock:
            run=self.require(run_id)
            if run['state'] in TERMINAL: return run
            run.update(state=state,updated_at=now(),**changes)
            self.store.put('runtime-run',run_id,run,run['project_id'])
            self.store.append(run_id,'job.state',{'state':state,**changes})
            return run

    def start(self, request):
        self.studio.require('project',request.project_id)
        if request.scenario=='backpressure' and request.profile_id not in {'picorv32_icarus','picorv32_verilator','systemc_tlm','systemc_verilated'}:
            raise DomainError('SCENARIO_UNAVAILABLE','Backpressure is implemented for PicoRV32 AXI and standalone SystemC only.',422)
        profile=next(p for p in self.capabilities()['profiles'] if p['id']==request.profile_id)
        if not profile['available']: raise DomainError('RUNTIME_UNAVAILABLE',profile['reason'],424)
        with self.lock:
            if sum(r['state'] not in TERMINAL for r in self.store.list('runtime-run'))>=4: raise DomainError('QUEUE_QUOTA','At most four fixed workflows may be queued.',429)
            run_id=identifier('runtime'); output='artifacts/runtime/'+run_id
            (ROOT/output).mkdir(parents=True)
            run={'id':run_id,'project_id':request.project_id,'profile_id':request.profile_id,'scenario':request.scenario,'state':'QUEUED','created_at':now(),'output':output,'result':None,'stages':[]}
            self.store.put('runtime-run',run_id,run,request.project_id,immutable=True)
            self.store.append(run_id,'job.state',{'state':'QUEUED'})
            self.pool.submit(self.execute,run_id)
            return run

    def cancel(self, run_id):
        with self.lock:
            run=self.require(run_id)
            if run['state'] in TERMINAL: return run
            (ROOT/run['output']/'cancel.request').touch()
            if run['state']=='QUEUED': return self.update(run_id,'CANCELLED',reason='USER_CANCELLED')
            # Worker acknowledges after killing its Linux process group.
            return self.update(run_id,'CANCELLING',reason='USER_CANCEL_REQUESTED')

    def execute(self, run_id):
        run=self.require(run_id)
        if run['state']=='CANCELLED': return
        self.update(run_id,'RUNNING')
        folder=ROOT/run['output']; cursor=0; stages={}; partial=b''
        try:
            with (folder/'launcher.stdout.log').open('wb') as stdout, (folder/'launcher.stderr.log').open('wb') as stderr:
                process=subprocess.Popen(launcher('workers.runtime.runner',['--profile',run['profile_id'],'--scenario',run['scenario'],'--output',linux_path(folder)]),stdout=stdout,stderr=stderr,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),shell=False)
                start=time.monotonic()
                while True:
                    event_file=folder/'events.jsonl'
                    if event_file.exists():
                        with event_file.open('rb') as stream: stream.seek(cursor); raw=stream.read(2_000_000); cursor+=len(raw)
                        lines=(partial+raw).split(b'\n'); partial=lines.pop()
                        for line in lines:
                            event=json.loads(line); self.store.append(run_id,event['kind'],event['data'])
                            if event['kind']=='stage.state': stages[event['data']['id']]=event['data']
                        with self.lock:
                            current=self.require(run_id); current['stages']=list(stages.values()); self.store.put('runtime-run',run_id,current,current['project_id'])
                    if process.poll() is not None: break
                    if time.monotonic()-start>1800: (folder/'cancel.request').touch()
                    if time.monotonic()-start>1830: process.kill(); process.wait(); raise TimeoutError('Runtime launcher exceeded wall limit')
                    time.sleep(.15)
            result_path=folder/'result.json'
            if not result_path.is_file(): raise RuntimeError('Worker did not produce a result; '+(folder/'launcher.stderr.log').read_text(errors='replace')[-1200:])
            result=json.loads(result_path.read_text())
            state={'PASS':'COMPLETED_PASS','FAIL':'COMPLETED_FAIL','CANCELLED':'CANCELLED','TIMED_OUT':'TIMED_OUT'}.get(result['status'],'FAILED_INFRA')
            self.update(run_id,state,result=result,stages=result['stages'])
        except Exception as exc: self.update(run_id,'FAILED_INFRA',reason=str(exc)[:2000])

    def artifact(self, run_id, artifact_id):
        run=self.require(run_id)
        artifacts=(run.get('result') or {}).get('artifacts',{})
        for name,item in artifacts.items():
            if item['sha256']!=artifact_id: continue
            path=(ROOT/name).resolve()
            if not path.is_relative_to((ROOT/run['output']).resolve()): raise DomainError('UNSAFE_ARTIFACT','Artifact escapes this run.',403)
            if not path.is_file(): raise DomainError('ARTIFACT_MISSING','Recorded artifact is missing.',404)
            if sha(path)!=artifact_id: raise DomainError('ARTIFACT_CHANGED','Artifact hash mismatch.',409)
            return path
        raise DomainError('NOT_FOUND','Artifact not found in this run.',404)

    def waveform(self, run_id, artifact_id, start, end, ids):
        if not re.fullmatch(r'\d{1,30}',start) or (end!='auto' and (not re.fullmatch(r'\d{1,30}',end) or int(end)<=int(start))): raise DomainError('INVALID_TIME','Use nonnegative integer ticks with end > start, or end=auto.')
        if ids and (len(ids.split(','))>8 or not re.fullmatch(r'[a-f0-9,]{1,199}',ids)): raise DomainError('INVALID_SIGNALS','Select up to eight trace signal IDs.')
        path=self.artifact(run_id,artifact_id)
        if path.suffix not in {'.vcd','.fst'}: raise DomainError('NOT_WAVEFORM','Selected artifact is not a waveform.')
        try:
            argv=[linux_path(path),'--start',start,'--ids',ids]
            if end!='auto': argv+=['--end',end]
            result=subprocess.run(launcher('workers.runtime.wave',argv),capture_output=True,text=True,timeout=30,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            if result.returncode or len(result.stdout)>2_000_000: raise ValueError(result.stderr[-1000:])
            return {**json.loads(result.stdout),'run_id':run_id,'artifact_sha256':artifact_id}
        except (subprocess.TimeoutExpired,ValueError) as exc: raise DomainError('WAVE_READER_FAILED',str(exc),424)

    def close(self):
        for run in self.store.list('runtime-run'):
            if run['state'] not in TERMINAL: self.cancel(run['id'])
        self.pool.shutdown(wait=True,cancel_futures=True)
