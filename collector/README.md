# 이 폴더는 이제 쓰지 않습니다

예전에는 제작기가 **링크로 가져오기**를 하려면 이 폴더의 작은 수집 서비스를 따로 켜야 했습니다.

```bash
cd collector
npm start        # ← 이제 필요 없습니다
```

지금은 그 일을 **BARODU Tools** 가 맡습니다.
BARODU 프로그램들이 함께 쓰는 공통 엔진이고, 한 번 설치하면 계속 켜져 있습니다.

```
BARODU PAGE MAKER  →  BARODU Tools  →  (실제 페이지 읽기)
```

제작기가 BARODU Tools 를 찾는 방법은 `src/config/baroduTools.ts` 와
`src/services/import/baroduTools.ts` 에 있습니다.

## 왜 지우지 않았나

- BARODU Tools 쪽 읽기 규칙을 손볼 때 **견주어 볼 기준**으로 쓸 수 있습니다.
  (예: 2026-09-15 에 여기서 고친 '사진이 한 장만 오던 문제' 는 BARODU Tools 에는 아직 반영되지 않았습니다)
- 지워도 제작기는 그대로 동작합니다. 필요 없다고 판단되면 폴더째 지우셔도 됩니다.

자세한 내용은 프로젝트 맨 위의 `WORK_STATUS.md` 를 보세요.
