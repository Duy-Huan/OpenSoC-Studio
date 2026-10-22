import { spawn } from 'node:child_process';
import { pythonExecutable as executable } from './python-path.mjs';
const child = spawn(executable, process.argv.slice(2), { stdio: 'inherit', windowsHide: true, shell: false });
child.on('error', e => { console.error(`Python unavailable: ${e.message}. Set OPENSOC_PYTHON or follow README setup.`); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
