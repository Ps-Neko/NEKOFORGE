# Example 00 — First verdict in 10 minutes

> 외부 사용자가 NEKOFORGE 로 **본인의 PR/변경** 에 대해 verdict 받는 가장 빠른 흐름.

## 사전 조건

- Node.js 20+
- git repository
- (선택) Codex CLI / Claude CLI — 없어도 stub 으로 동작

## 1. 설치 (1 분)

```bash
$ git clone https://github.com/Ps-Neko/NEKOFORGE.git
$ cd NEKOFORGE
$ npm install
$ npm run build
```

전역 alias 사용 시:

```bash
$ npm link
$ nekoforge --version
0.5.0-alpha.0
```

## 2. 본인 repo 에서 시작 (1 분)

```bash
$ cd ~/your-project
$ nekoforge doctor
```

doctor 가 환경 점검 후 fix hint 출력:

```text
[ok] Node.js v20.18.0 >= 20
[ok] git repository detected
[warn] .harness/ missing
       fix: harness init
[next] harness init
```

## 3. preset 으로 초기화 (1 분)

본인 프로젝트 타입에 맞춰:

```bash
# CLI 도구
$ nekoforge init --preset cli-tool

# Web UI
$ nekoforge init --preset web-ui

# Backend API
$ nekoforge init --preset backend-api

# 라이브러리
$ nekoforge init --preset library
```

생성 결과:

```text
.harness/
├── workers.json          # standard 또는 strict profile
├── rule-packs.json       # template 기준 enabled pack
├── skill-packs.json
└── quality-contract.json # template + placeholder productIntent
```

⚠️ **중요**: `quality-contract.json` 의 productIntent (user/problem/coreValue) 가 placeholder. 실제 사용자/문제/가치를 채워야 work 단계 통과.

```bash
$ nekoforge contract --template <preset> --task TASK-001 --answers your-answers.json
# 또는 .harness/quality-contract.json 직접 편집
```

## 4. 본인 변경 회수 (3 분)

본인이 만든 commit 또는 working tree diff 가 있는 상태에서:

```bash
$ nekoforge work TASK-001
$ nekoforge review
$ nekoforge gate
```

또는 한 줄 자가 검증 (tmpdir 격리 실행):

```bash
$ nekoforge self-host --goal "PR 설명"
```

## 5. verdict 결과 해석 (2 분)

`nekoforge gate` 종료 출력 예:

```text
[verdict] PASS_WITH_WARNINGS
[rules]   no-test-risk, missing-input-validation-risk
[next]    review REPORT.md → nekoforge apply --approved
```

본인 변경에 대해:
- **PASS** — apply 허용
- **PASS_WITH_WARNINGS** — apply 허용 (warning 검토 권장)
- **NEEDS_HUMAN_REVIEW** — `.harness/approval.txt` 의 토큰 매칭 시에만 apply
- **BLOCK** — 어떤 플래그로도 apply 불가 (원인 수정 후 재실행)
- **INSUFFICIENT_EVIDENCE** — evidence 누락 (worker / rule-pack / contract)

자세한 신호:

```bash
$ cat .harness/decision.json | jq '.verdict, .deterministicRules.triggeredRules, .qualityContract.failedBars, .workerFactory'
$ cat REPORT.md
```

## 6. 자주 막히는 곳 (1 분)

| 증상 | 원인 | 해결 |
|---|---|---|
| `quality-contract.json missing` | contract 단계 누락 | `nekoforge contract --template <name> --task TASK-001` |
| `worker-missing-required` | workers init 후 worker-result 없음 | `nekoforge dispatch TASK-001 --all` + import |
| `rule-pack-missing` | template required pack 비활성 | `nekoforge rule-pack enable <pack>` |
| `pre-tool hook failed: exit=?` (Windows) | .cmd 해상도 (v0.4 이전 버그) | v0.5+ 에서 해결됨 |

## 7. 외부 검증 보고

본 도구가 본인 프로젝트에서 어떻게 작동했는지 보고:

1. [docs/EXTERNAL-VALIDATION-TEMPLATE.md](../../docs/EXTERNAL-VALIDATION-TEMPLATE.md) 양식 작성
2. GitHub Issue 생성 (`external-validation` 템플릿)
3. 첨부: REPORT.md + `.harness/decision.json` + `.harness/quality-score.json`

→ 본 도구가 Beta 진입할 수 있게 도와줍니다. CONTRIBUTING.md 참조.

## 8. 다음 읽을 것

- [GETTING-STARTED.md](../../GETTING-STARTED.md) — 14단계 전체 흐름
- [docs/PRODUCT.md](../../docs/PRODUCT.md) — 본 도구의 정체성 + 비-목표
- [docs/CLI.md](../../docs/CLI.md) — 26 명령 도움말
- [examples/](..) — 10 시나리오 + Phase 흔적 12
