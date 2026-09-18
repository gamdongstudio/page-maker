import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const collector = fileURLToPath(new URL('../collector/server.js', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

const children = [
  spawn(process.execPath, [collector], { stdio: 'inherit' }),
  spawn(process.execPath, [vite], { stdio: 'inherit' }),
];

let ending = false;
function stop(code = 0) {
  if (ending) return;
  ending = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exitCode = code;
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!ending && code && code !== 0) stop(code);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
