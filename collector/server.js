import { readFileSync } from 'node:fs';
import express from 'express';
import { collectFromUrl } from './collect.js';

/**
 * 링크로 가져오기 — 작은 수집 서비스.
 *
 * SAY PAGE MAKER 화면(브라우저)에서는 Playwright 를 돌릴 수 없어서
 * 이 작은 서버가 대신 페이지를 열어 읽고 결과만 돌려준다.
 *
 * 구조: 화면 → (vite 프록시) → 이 서버 → Playwright → 정리된 JSON → 화면
 *
 * 이 서버는 **읽기만** 한다. 로그인하지 않고, 외부 사이트를 고치지 않는다.
 */

/**
 * 쓰는 자리(포트)는 `collector.config.json` **한 곳**에서만 관리한다.
 * 화면(vite.config.ts)과 공개용 중계 서버도 같은 값을 본다.
 */
const CONFIG = JSON.parse(
  readFileSync(new URL('../collector.config.json', import.meta.url), 'utf8'),
);
const PORT = Number(process.env.COLLECTOR_PORT ?? CONFIG.port ?? 5198);

/** 이 서비스임을 알아볼 이름 — 화면이 다른 프로그램과 헷갈리지 않게 한다 */
const SERVICE = 'saypagemaker-collector';
const app = express();
app.use(express.json({ limit: '1mb' }));

/* 이 컴퓨터 안에서만 쓴다 */
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5180');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  return next();
});

/**
 * 켜져 있는지 확인용.
 *
 * `service` 이름을 꼭 함께 보낸다.
 * 이 자리(5199)를 **다른 프로그램이 먼저 쓰고 있을 수 있는데**, 그 프로그램도
 * `{"ok":true}` 같은 답을 주면 화면이 "켜져 있다"고 잘못 알게 된다.
 * (실제로 다른 프로그램이 이 자리를 차지한 일이 있었다)
 */
app.get('/api/health', (_req, res) => res.json({ ok: true, service: SERVICE }));

app.post('/api/import-url', async (req, res) => {
  const url = String(req.body?.url ?? '').trim();

  if (!/^https?:\/\/.+/i.test(url)) {
    return res.status(400).json({ ok: false, reason: '주소가 http:// 또는 https:// 로 시작해야 합니다.' });
  }

  try {
    const got = await collectFromUrl(url);

    /* 스마트플레이스를 열기는 했지만 가게 내용을 못 읽은 경우 — 그대로 알린다 */
    if (got.unreadable) {
      return res.json({
        ok: false,
        reason: '스마트플레이스에서 가게 내용을 읽지 못했습니다. 네이버 쪽 화면이 바뀌면 이런 일이 생깁니다.'
          + ' 블로그 주소를 넣거나, 아래 내용 붙여넣기를 써주세요.',
      });
    }

    if (!got.text && got.images.length === 0) {
      return res.json({ ok: false, reason: '이 페이지에서 읽을 수 있는 내용을 찾지 못했습니다. 비공개 글이거나 로그인이 필요한 페이지일 수 있어요.' });
    }
    return res.json(got);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 문제';

    /* 화면에는 짧게 알리지만, 이 창에는 **전체 내용**을 남긴다.
       예전에는 80자에서 잘려 나가 진짜 원인(브라우저 파일 경로 등)이 보이지 않았다. */
    console.error('[수집 실패]', url);
    console.error(e instanceof Error ? (e.stack ?? e.message) : e);

    return res.json({
      ok: false,
      reason: /timeout/i.test(msg)
        ? '페이지가 너무 느려 읽지 못했습니다. 잠시 뒤 다시 해보세요.'
        : `페이지를 열지 못했습니다. (${msg.slice(0, 80)})`
          + ' 자세한 내용은 수집 서비스를 켜둔 명령창에 적혀 있습니다.',
    });
  }
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[수집 서비스] http://127.0.0.1:${PORT} 에서 기다립니다.`);
});

/* 자리를 다른 프로그램이 이미 쓰고 있으면 그대로 알린다 — 조용히 죽지 않는다 */
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`[수집 서비스] ${PORT} 번 자리를 다른 프로그램이 이미 쓰고 있습니다.`);
    console.error('  그 프로그램을 끄거나, collector.config.json 의 port 를 빈 자리로 바꿔주세요.');
    console.error('  (화면과 중계 서버도 그 값을 같이 봅니다)');
  } else {
    console.error('[수집 서비스] 켜지 못했습니다:', e.message);
  }
  process.exit(1);
});
