import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const collectorDir = fileURLToPath(new URL('../collector/', import.meta.url));
const collectorServer = fileURLToPath(new URL('../collector/server.js', import.meta.url));
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

if (!existsSync(new URL('../collector/node_modules/express/package.json', import.meta.url))) {
  console.log('[준비] 스마트플레이스 수집 모듈을 처음 한 번만 설치합니다.');
  await run(npm, ['install', '--no-audit', '--no-fund'], { cwd: collectorDir });
}

const collector = spawn(process.execPath, [collectorServer], { cwd: root, stdio: 'inherit' });
const vite = spawn(process.execPath, [viteBin], { cwd: root, stdio: 'inherit' });

let ending = false;
function stop(code = 0) {
  if (ending) return;
  ending = true;
  for (const child of [collector, vite]) {
    if (!child.killed) child.kill();
  }
  process.exitCode = code;
}

collector.on('exit', (code) => {
  if (!ending && code && code !== 0) {
    console.error('[수집 서비스] 종료되었습니다. PageMaker는 계속 열리지만 링크 가져오기는 PM Connect로 대체됩니다.');
  }
});
vite.on('exit', (code) => stop(code ?? 0));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
