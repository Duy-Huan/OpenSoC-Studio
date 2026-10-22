"""Execute cancellation/timeout process-tree checks on real Linux children."""
import json
import os
import sys
import threading
import time
from pathlib import Path
from .runner import ROOT, Run

def main():
    output=ROOT/'artifacts/runtime'/('control-'+str(time.time_ns()))
    run=Run(output,'systemc_tlm','baseline');run.stage('process_controls')
    script="import subprocess,sys,time; p=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)']); print(p.pid,flush=True); time.sleep(30)"
    results=[]
    for kind in ['cancel','timeout']:
        if kind=='cancel':
            timer=threading.Timer(.4,lambda:(output/'cancel.request').touch());timer.start()
        try: run.command(kind,[sys.executable,'-c',script],timeout=.5 if kind=='timeout' else 10)
        except RuntimeError as exc: reason=str(exc)
        else: raise AssertionError('Control failed to interrupt native process')
        if kind=='cancel': timer.join();(output/'cancel.request').unlink()
        command=run.commands[-1]
        child=int((ROOT/command['stdout']).read_text().strip())
        deadline=time.monotonic()+3
        while Path(f'/proc/{child}').exists() and time.monotonic()<deadline: time.sleep(.05)
        if Path(f'/proc/{child}').exists(): raise AssertionError('Child survived process-group kill')
        assert reason==('CANCELLED' if kind=='cancel' else 'TIMED_OUT')
        results.append({'control':kind,'status':'PASS','reason':reason,'child_pid':child,'child_reaped':True,'command':command})
    target=ROOT/'docs/test-evidence/runtime/process-controls.json'
    target.write_text(json.dumps({'status':'PASS','checks':results},indent=2)+'\n')
    print('Actual cancellation and timeout process-tree checks: PASS')
if __name__=='__main__': main()
