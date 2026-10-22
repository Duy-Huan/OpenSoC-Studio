import { existsSync, mkdirSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('../..',import.meta.url));
process.chdir(root);
if(process.platform!=='win32') throw Error('This bootstrap provisions the tested Windows/WSL environment only.');
const linuxRoot='/mnt/'+root[0].toLowerCase()+root.slice(2).replaceAll('\\','/');
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit',windowsHide:true,shell:false});if(result.error||result.status!==0)throw result.error??Error(`${command}: exit ${result.status}`);}
const inventory=spawnSync('wsl.exe',['--list','--quiet'],{encoding:'utf16le',windowsHide:true});
if(inventory.status!==0)throw Error('WSL service unavailable: '+inventory.stderr);
if(!inventory.stdout.includes('OpenSoC-Runtime')){
  if(!existsSync('.tools/downloads/ubuntu-rootfs.tar.gz'))run(process.execPath,['infra/scripts/fetch-linux-runtime.mjs']);
  const hash=createHash('sha256');for await(const chunk of createReadStream('.tools/downloads/ubuntu-rootfs.tar.gz'))hash.update(chunk);
  if(hash.digest('hex')!=='2a790896740b14d637dbdc583cce1ba081ac53b9e9cdb46dc09a2f73abbd9934')throw Error('Cached Ubuntu image digest mismatch');
  mkdirSync('.tools',{recursive:true});
  run('wsl.exe',['--import','OpenSoC-Runtime',resolve('.tools/wsl-runtime'),resolve('.tools/downloads/ubuntu-rootfs.tar.gz'),'--version','2']);
}
run('wsl.exe',['-d','OpenSoC-Runtime','-u','root','--','bash',linuxRoot+'/infra/scripts/setup-linux-runtime.sh']);
for(const script of ['prepare-ibex.sh','build-ibex.sh','build-gem5.sh'])run('wsl.exe',['-d','OpenSoC-Runtime','-u','opensoc','--','bash',linuxRoot+'/infra/scripts/'+script]);
for(const module of ['workers.runtime.probe','workers.runtime.lock','workers.runtime.compliance'])run('wsl.exe',['-d','OpenSoC-Runtime','-u','opensoc','--cd',linuxRoot,'--','/opt/opensoc/venv/bin/python','-m',module]);
console.log('Toolchain builds complete. Start the API, then run npm.cmd run runtime:verify for actual workload acceptance.');
