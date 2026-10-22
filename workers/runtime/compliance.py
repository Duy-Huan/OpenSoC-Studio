"""Save toolchain notices and inventory; does not grant release license clearance."""
import hashlib
import importlib.metadata as metadata
import json
import re
import shutil
from pathlib import Path
from .runner import ROOT

def main():
    folder=ROOT/'docs/compliance/license-evidence/runtime';folder.mkdir(parents=True,exist_ok=True)
    sources={name:Path('/usr/share/doc')/name/'copyright' for name in ['verilator','iverilog','yosys','gcc-riscv64-unknown-elf','binutils-riscv64-unknown-elf','libsystemc','libsystemc-dev','scons','srecord','libelf-dev']}
    sources.update({'ibex':Path('/opt/opensoc/src/ibex/LICENSE'),'gem5':Path('/opt/opensoc/src/gem5/LICENSE')})
    records=[]
    for name,source in sources.items():
        target=folder/(name+'.txt')
        if source.is_file(): shutil.copyfile(source,target);records.append({'name':name,'source':str(source),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'status':'REVIEW_REQUIRED'})
        else: records.append({'name':name,'source':str(source),'status':'MISSING_LICENSE_EVIDENCE'})
    wheel_data=json.loads((ROOT/'docs/test-evidence/runtime/linux-python-wheels.json').read_text())
    notices=[];components=[]
    for component in wheel_data['components']:
        dist=metadata.distribution(component['name'])
        texts=[]
        for entry in dist.files or []:
            if re.search(r'(^|/)(LICENSE|LICENCE|COPYING|NOTICE)([./_-]|$)',str(entry),re.I):
                path=Path(dist.locate_file(entry))
                if path.is_file() and path.stat().st_size<200000:
                    text=path.read_text(errors='replace');texts.append(text)
        if not texts and component.get('license_metadata'): texts.append(component['license_metadata'])
        notices.append('## '+component['name']+' '+component['version']+'\n\n'+'\n\n'.join(texts))
        components.append({'type':'library','name':component['name'],'version':component['version'],'purl':f'pkg:pypi/{component["name"]}@{component["version"]}','hashes':[{'alg':'SHA-256','content':component['sha256']}],'properties':[{'name':'opensoc:license-review','value':'REVIEW_REQUIRED'}]})
    (ROOT/'RUNTIME_THIRD_PARTY_NOTICES.md').write_text('# External Linux Python toolchain notices\n\nSeparate from API dependencies. Metadata/text evidence only; no redistribution clearance. Native tools: `docs/compliance/license-evidence/runtime/`.\n\n'+'\n\n'.join(notices)+'\n')
    (ROOT/'docs/test-evidence/runtime/license-inventory.json').write_text(json.dumps({'status':'REVIEW_REQUIRED','scope':'External tools and sources; firmware runtime/OS/full per-file closure remains open','native':records},indent=2)+'\n')
    (ROOT/'sbom/runtime-python.cdx.json').write_text(json.dumps({'bomFormat':'CycloneDX','specVersion':'1.5','version':1,'components':components},indent=2)+'\n')
    print('Tool/source notices and external Python SBOM retained; release review remains required.')
if __name__=='__main__': main()
