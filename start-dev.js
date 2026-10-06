import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function checkBackend(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function start() {
  const isRunning = await checkBackend('http://127.0.0.1:8000/api/health');
  if (isRunning) {
    console.log('✅ FastAPI backend is active on http://127.0.0.1:8000');
  } else {
    console.log('🚀 Starting FastAPI backend server on http://127.0.0.1:8000...');
    const backendDir = path.join(__dirname, 'backend');
    const venvPythonWin = path.join(backendDir, '.venv_win', 'Scripts', 'python.exe');
    const venvPythonUnix = path.join(backendDir, '.venv', 'bin', 'python');
    
    let pythonExe = 'python';
    if (fs.existsSync(venvPythonWin)) {
      pythonExe = venvPythonWin;
    } else if (fs.existsSync(venvPythonUnix)) {
      pythonExe = venvPythonUnix;
    }

    const backendProcess = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
      cwd: backendDir,
      stdio: 'inherit',
      shell: false
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend server:', err);
    });
  }

  console.log('⚡ Starting Vite frontend dev server...');
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  spawn(npxCmd, ['vite', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });
}

start();
