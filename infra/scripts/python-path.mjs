import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
export const pythonExecutable = process.env.OPENSOC_PYTHON ?? (process.platform === 'win32' && existsSync('.tools/python/python.exe') ? resolve('.tools/python/python.exe') : process.platform === 'win32' ? resolve('.venv/Scripts/python.exe') : resolve('.venv/bin/python'));
