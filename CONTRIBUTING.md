# Contributing to NEKOFORGE

> 외부 사용자가 본 도구를 사용해 PR 1건 머지하면 Beta 진입 마지막 조건 충족 ([ROADMAP §10](docs/ROADMAP.md#10-외부-검증-기준-beta--10-진입-조건)).

## 1. 본 도구의 정체성 (먼저 읽을 것)

```text
NEKOFORGE 는 AI 작업자를 배치하고 / 룰·스킬팩을 적용하고 /
Quality Contract 기준으로 점수화한 뒤 / Human Gate 전에는
출고하지 못하게 막는 local-first AI Development Factory.
```

**무엇이 아닌가:**
- OMC 식 무인 작업반 운영 도구 X
- ECC 식 대형 카탈로그 마켓플레이스 X
- SaaS 대시보드 X
- 자동 commit/push/deploy 도구 X

기여 전에 [docs/PRODUCT.md](docs/PRODUCT.md) 와 [docs/ROADMAP.md §8 영구 비-목표](docs/ROADMAP.md#8-영구-비-목표) 를 읽어 본 도구가 무엇이 **아닌지** 먼저 이해해 주세요.

## 2. 기여 절차

### 2-1. Issue 먼저

작은 typo / 문서 개선이 아니라면 PR 전에 Issue 로 논의:

- Bug: [Bug report template](https://github.com/Ps-Neko/NEKOFORGE/issues/new?template=bug.yml)
- Feature: [Feature request template](https://github.com/Ps-Neko/NEKOFORGE/issues/new?template=feature.yml)
- 정체성 문제: [discussion](https://github.com/Ps-Neko/NEKOFORGE/discussions) 사용 권장

### 2-2. 본 도구로 본인의 PR 을 검증

NEKOFORGE 가 본 도구를 사용해 본인의 변경을 self-host 회수:

```bash
$ harness self-host --goal "(PR 설명)"
```

verdict 가 `BLOCK` / `INSUFFICIENT_EVIDENCE` 면 그 PR 은 본 도구가 막아야 할 변경입니다. 원인을 해결해 주세요.

verdict 가 `NEEDS_HUMAN_REVIEW` 면 `.harness/approval.txt` 에 토큰 추가 + PR 본문에 그 근거 명시.

### 2-3. PR 본문에 포함할 것

- self-host verdict 결과 (스크린샷 또는 텍스트)
- 본 변경이 본 도구의 정체성 (`docs/PRODUCT.md`) 과 충돌하지 않는지 self-check 한 줄
- breaking change 면 `RELEASE-NOTES.md` 갱신 포함

### 2-4. 검증 명령 (PR 머지 전 필수)

```bash
$ npm run verify
# = typecheck + lint + depcheck + test
```

추가 권장:

```bash
$ npm run benchmark     # critical recall / FP rate 측정
$ harness self-host     # 본 도구로 본 변경 회수
```

## 3. 코딩 가이드

### 3-1. TypeScript strict

- `tsconfig.json` strict 모드 켜져 있음. `any` 사용 시 PR 거부됨.
- public API 는 explicit return type.

### 3-2. 파일 조직

- core 단계 (`src/core/<stage>/`) 는 다른 core 단계를 import 할 수 없음 (dependency-cruiser 의 `no-cross-stage-core`). 공유 로직은 leaf 디렉터리 (`src/scoring/`, `src/workers/`, `src/rule-packs/`, `src/skill-packs/` 등) 로 분리.
- 한 파일 800 LOC 초과 시 `large-file-risk` 자동 발화.

### 3-3. 테스트

- TDD 권장 — 실패하는 테스트 먼저, 구현 다음.
- 테스트 위치:
  - `tests/unit/<area>/<name>.test.ts` — 단위
  - `tests/integration/<name>.test.ts` — CLI 통합
  - `tests/e2e/<name>.test.ts` — T-SEC / T-WF / T-RP 시리즈
- 새 rule 추가 시 fixture (`fixtures/<group>/<name>-positive/`) 도 함께.

### 3-4. 커밋 메시지

```text
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

본 레포는 commit attribution 을 사용하지 않음 (`~/.claude/settings.json` 의 정책).

## 4. 어떤 기여를 환영하는가

| 종류 | 환영 정도 |
|---|---|
| 새 fixture (positive / negative) | ⭐⭐⭐ 매우 환영 — Beta 조건 직접 영향 |
| 새 rule (deterministic 휴리스틱) | ⭐⭐⭐ 환영 — SECURITY.md §4 절차 따름 |
| 새 rule pack 후보 | ⭐⭐ 환영 — 단, 8개 큐레이션 유지 (ECC 마켓 X) |
| 새 skill pack 후보 | ⭐⭐ 환영 — 단, 7개 큐레이션 유지 |
| 새 export adapter (codex/cursor/claude/generic 외) | ⭐⭐ 환영 — 결정적 + 단방향 |
| 새 worker role (8개 외) | ⭐ 조심 — 정체성 검토 필요 |
| 자동 LLM 실행 / agent autonomous loop | ❌ 비-목표 (영구 §8) |
| SaaS dashboard / 클라우드 동기화 | ❌ 비-목표 |

## 5. 외부 검증 cycle 도입 (선택)

본 레포는 Codex review 사이클을 4회 통합한 기록 있음 (`examples/phase-codex-{feedback,rereview,review-3}/`). 큰 변경 시 외부 검증 받고 결과를 `.review-requests/<topic>.response.md` 에 보존하는 패턴 권장.

## 6. License

MIT — see `LICENSE`.

## 7. Code of Conduct

기여자는 본 도구의 정체성을 존중. 본 도구를 OMC/ECC 클론으로 만들지 말 것. 의문이 있으면 Issue 또는 Discussion 으로.
