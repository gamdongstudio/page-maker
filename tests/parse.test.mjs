/**
 * 읽는 규칙 회귀 시험.
 *
 *   node --experimental-strip-types tests/parse.test.mjs
 *
 * 무엇을 하나
 *   `tests/fixtures/` 에 고정해 둔 **실제 사진관 페이지 자료**를 읽는 규칙에 통과시켜,
 *   `tests/expected.json` 의 **사람이 확인한 맞는 값**과 견줍니다.
 *
 * 왜 필요한가
 *   규칙 한 줄을 고치면 다른 사진관이 조용히 틀려지기 쉽습니다.
 *   네이버 화면이 바뀌거나 인터넷이 없어도 이 시험은 그대로 돌아갑니다.
 *
 * 자료를 새로 뜨려면 (BARODU Tools 가 켜져 있어야 함)
 *   scratchpad 의 make-fixtures.mjs 참고
 *
 * ⚠ 특정 사진관 이름을 규칙에 넣지 마세요. **공통 규칙**이 이 값을 맞춰야 합니다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

const { parseStudioText } = await import(
  pathToFileURL(join(HERE, '..', 'src', 'services', 'read', 'parseInfo.ts')).href
);

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const expected = readJson(join(HERE, 'expected.json'));

let pass = 0;
let fail = 0;
const failures = [];

const names = readdirSync(FIXTURES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

for (const name of names) {
  const fx = readJson(join(FIXTURES, `${name}.json`));
  const want = expected[name];

  /* 화면과 똑같은 방식으로 글을 합친다 */
  const text = [fx.title, fx.description, fx.text].filter(Boolean).join('\n');
  const got = parseStudioText(text);
  const by = new Map(got.map((f) => [f.label, f.value]));

  const found = got.filter((f) => f.value).length;
  console.log(`\n■ ${name}  (${fx.sourceType}, 글 ${fx.text.length}자, 사진 ${fx.imageCount}장 · 찾은 항목 ${found}개)`);
  if (want && want._메모) console.log(`  ${want._메모}`);

  if (!want) {
    console.log('  (맞는 값이 정해지지 않아 확인하지 않습니다)');
    continue;
  }

  for (const [label, wanted] of Object.entries(want)) {
    if (label.startsWith('_')) continue;

    const have = (by.get(label) ?? '').trim();
    const ok = wanted === null ? have === '' : have === wanted;

    if (ok) {
      pass += 1;
      console.log(`  ✓ ${label}${wanted === null ? ' (비어 있음)' : ` = ${have}`}`);
    } else {
      fail += 1;
      const msg = `${name} → ${label}\n      바람: ${wanted === null ? '(비어 있어야 함)' : JSON.stringify(wanted)}\n      나옴: ${JSON.stringify(have)}`;
      failures.push(msg);
      console.log(`  ✗ ${label}  바람=${wanted === null ? '(비어야 함)' : JSON.stringify(wanted)}  나옴=${JSON.stringify(have)}`);
    }
  }
}

console.log('\n' + '='.repeat(64));
console.log(`결과: 맞음 ${pass} · 틀림 ${fail}   (자료 ${names.length}곳)`);

if (failures.length) {
  console.log('\n틀린 것:');
  failures.forEach((m, i) => console.log(`  ${i + 1}) ${m}`));
}

process.exit(fail ? 1 : 0);
