const { spawn } = require('child_process');
const path = require('path');

const venvPath = path.join(__dirname, 'backend', 'venv', 'Scripts', 'python.exe');
const mainPath = path.join(__dirname, 'backend', 'main.py');

console.log(`Starting backend with: ${venvPath} ${mainPath}`);

const backend = spawn(venvPath, [mainPath], {
  cwd: path.join(__dirname, 'backend'),
  detached: true,
  stdio: 'inherit'
});

backend.on('error', (err) => {
  console.error('Failed to start backend:', err);
});

console.log('Backend process spawned.');
process.exit(0);
