"""Inventory actual Linux tools; existence is not functional acceptance."""
import hashlib
import importlib.metadata
import json
import shutil
import subprocess
from pathlib import Path
from .runner import ROOT

def main():
    commands={'verilator':['verilator','--version'],'iverilog':['iverilog','-V'],'yosys':['yosys','-V'],'riscv_gcc':['riscv64-unknown-elf-gcc','--version'],'g++':['g++','--version'],'systemc':['pkg-config','--modversion','systemc'],'fusesoc':['/opt/opensoc/venv/bin/fusesoc','--version']}
    items={}
    for name,argv in commands.items():
        result=subprocess.run(argv,capture_output=True,text=True,timeout=10)
        path=Path(shutil.which(argv[0]) or argv[0]).resolve()
        with path.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
        items[name]={'version_output':(result.stdout+result.stderr)[:1200],'exit_code':result.returncode,'path':str(path),'sha256':digest}
    items['wellen']={'version':importlib.metadata.version('pywellen')}
    items['gem5']={'path':'/opt/opensoc/src/gem5/build/RISCV/gem5.opt','available':Path('/opt/opensoc/src/gem5/build/RISCV/gem5.opt').is_file()}
    if items['gem5']['available']:
        path=Path(items['gem5']['path'])
        with path.open('rb') as stream: items['gem5']['sha256']=hashlib.file_digest(stream,'sha256').hexdigest()
        result=subprocess.run([path,'--build-info'],capture_output=True,text=True,timeout=15)
        items['gem5']['version_output']=(result.stdout+result.stderr)[:2000]
        items['gem5']['probe_exit_code']=result.returncode
    ibex=Path('/opt/opensoc/src/ibex/build/lowrisc_ibex_ibex_simple_system_0/sim-verilator/Vibex_simple_system')
    items['ibex']={'path':str(ibex),'available':ibex.is_file()}
    if ibex.is_file():
        with ibex.open('rb') as stream: items['ibex']['sha256']=hashlib.file_digest(stream,'sha256').hexdigest()
    raw=json.dumps({'schema_version':'1.0','distro':'OpenSoC-Runtime','user':'opensoc','tools':items,'scope':'Prepared tools; each runtime still requires workflow acceptance'},indent=2)+'\n'
    target=ROOT/'.tools/runtime-ready.json'; temporary=target.with_suffix('.tmp');temporary.write_text(raw);temporary.replace(target)
    (ROOT/'docs/test-evidence/runtime/toolchains.json').write_text(raw)
    print('Runtime inventory recorded')
if __name__=='__main__': main()
