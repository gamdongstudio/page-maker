/**
 * BARODU PAGE MAKER 를 **명령어 없이** 열기 위한 작은 서버.
 *
 * 왜 필요한가
 *   완성된 화면 파일(dist)을 그냥 더블클릭해서 열면 (file:// 주소)
 *   브라우저가 BARODU Tools 에 연결하는 것을 막아 '링크로 가져오기' 가 되지 않는다.
 *   그래서 이 컴퓨터 안에서만 열리는 주소로 잠깐 띄워 준다.
 *
 * 하는 일
 *   - `dist` 폴더 안의 파일만 내보낸다 (그 바깥은 절대 내보내지 않는다)
 *   - 준비가 끝나면 브라우저를 알아서 열어 준다
 *
 * 끄는 법: 이 창을 닫으면 된다.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', 'dist');
const PORTS = [5180, 5181, 5182, 5183];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('\n  화면 파일을 찾지 못했습니다.');
  console.error('  ' + ROOT + '\n');
  console.error('  처음 한 번만 아래를 실행해 주세요:  npm install  그리고  npm run build\n');
  process.stdin.resume();
}

const server = http.createServer((req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (rel.endsWith('/')) rel += 'index.html';

    let file = path.join(ROOT, rel);
    /* dist 바깥으로 빠져나가는 요청은 막는다 */
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    /* 한 페이지 앱이라 없는 주소는 첫 화면으로 */
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');

    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(500).end('error');
  }
});

function listen(i = 0) {
  if (i >= PORTS.length) {
    console.error('\n  열 수 있는 자리가 없습니다. 열려 있는 BARODU PAGE MAKER 창을 닫고 다시 해주세요.\n');
    process.stdin.resume();
    return;
  }

  server.once('error', () => listen(i + 1));
  server.listen(PORTS[i], '127.0.0.1', () => {
    const url = `http://localhost:${PORTS[i]}`;
    console.log('');
    console.log('  BARODU PAGE MAKER 가 준비됐습니다.');
    console.log('');
    console.log('     ' + url);
    console.log('');
    console.log('  브라우저가 곧 열립니다. 다 쓰신 뒤에는 이 검은 창을 닫으면 됩니다.');
    console.log('');
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  });
}

listen();
