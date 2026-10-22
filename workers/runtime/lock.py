"""Retain exact Linux Python wheels, hashes, installed tool/package inventory."""
import hashlib
import importlib.metadata as metadata
import json
import subprocess
import zipfile
from email.parser import BytesParser
from pathlib import Path
from .runner import ROOT

def main():
    folder=ROOT/'docs/test-evidence/runtime'; folder.mkdir(exist_ok=True)
    freeze=subprocess.check_output(['/opt/opensoc/venv/bin/pip','freeze'],text=True)
    (folder/'linux-python.freeze.txt').write_text(freeze)
    wheelhouse=Path('/opt/opensoc/wheelhouse');wheelhouse.mkdir(exist_ok=True)
    subprocess.run(['/opt/opensoc/venv/bin/pip','wheel','--no-deps','--wheel-dir',str(wheelhouse),'-r',str(folder/'linux-python.freeze.txt')],check=True)
    entries=[]; lines=[]
    for wheel in sorted(wheelhouse.glob('*.whl')):
        with zipfile.ZipFile(wheel) as archive:
            raw=archive.read(next(n for n in archive.namelist() if n.endswith('.dist-info/METADATA')))
            info=BytesParser().parsebytes(raw)
        with wheel.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
        entries.append({'name':info['Name'],'version':info['Version'],'wheel':wheel.name,'sha256':digest,'license_expression':info['License-Expression'],'license_metadata':info['License'],'status':'REVIEW_REQUIRED'})
        lines.append(f'{info["Name"]}=={info["Version"]} --hash=sha256:{digest}')
    (folder/'linux-python.requirements.lock').write_text('\n'.join(lines)+'\n')
    (folder/'linux-python-wheels.json').write_text(json.dumps({'scope':'External Linux toolchain Python dependencies; not API runtime redistribution clearance','components':entries},indent=2)+'\n')
    packages=subprocess.check_output(['dpkg-query','-W','-f=${Package}\t${Version}\n'],text=True)
    (folder/'linux-packages.tsv').write_text(packages)
    result=subprocess.run(['/opt/opensoc/venv/bin/pip','install','--dry-run','--ignore-installed','--no-index','--find-links',str(wheelhouse),'--require-hashes','-r',str(folder/'linux-python.requirements.lock')],capture_output=True,text=True)
    (folder/'offline-python-resolution.log').write_text(result.stdout+result.stderr)
    if result.returncode: raise RuntimeError('Offline wheel/hash closure verification failed')
    print(f'{len(entries)} exact Python toolchain wheels; offline hash resolution PASS')
if __name__=='__main__': main()
