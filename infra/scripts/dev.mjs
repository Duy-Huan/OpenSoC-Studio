import { spawn } from 'node:child_process';
import { pythonExecutable } from './python-path.mjs';
const children = [
  spawn(pythonExecutable, ['-m', 'uvicorn', 'apps.api.main:app', '--host', '127.0.0.1', '--port', '8000'], { stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'apps/web/vite.config.ts'], { stdio: 'inherit', windowsHide: true }),
];
let stopping = false;
function stop() { if (stopping) return; stopping = true; for (const child of children) child.kill(); }
for (const child of children) { child.on('error', e => { console.error(e.message); stop(); }); child.on('exit', () => stop()); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
