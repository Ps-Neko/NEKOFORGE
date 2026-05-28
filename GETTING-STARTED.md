# Getting Started — NEKOFORGE in 10 minutes

> 본 가이드는 NEKOFORGE 를 처음 보는 사용자가 10분 안에 **소스 기반 작업 패킷과 첫 verdict** 를 받아보는 흐름이다.

## 0. 사전 조건

- Node.js 20+
- git
- (선택) Codex CLI 또는 Claude CLI — review 단계의 실 어댑터 호출 시. 1차 시도에서는 stub 만으로 충분.

## 1. 설치 (1분)

```bash
$ git clone https://github.com/Ps-Neko/NEKOFORGE.git
$ cd NEKOFORGE
$ npm install
$ npm run build
```

## 1-A. 먼저 demo로 보기 (1분)

```bash
$ node dist/src/cli/index.js demo productivity --clean
$ node dist/src/cli/index.js demo safety --clean
```

- `productivity`: 기존 소스를 AI 작업 맥락과 작업 패킷으로 바꾸는 장면.
- `safety`: 위험한 AI diff를 적용 전에 막는 장면.

전역 설치를 원하면:

```bash
$ npm link
$ nekoforge --version          # (또는 harness — 같은 명령)
0.5.0-alpha.0
```

## 2. 환경 점검 (선택, 30초)

```bash
$ nekoforge doctor
```

12 검사 후 fix hint 출력. `.harness/` 가 없어도 OK — 다음 단계 안내함.

## 3. 프로젝트에서 init (1분)

### 3-A. preset 한 줄 (권장)

본 도구가 처음이면 preset 으로 시작:

```bash
$ nekoforge init --preset cli-tool
# 또는: --preset web-ui | backend-api | library
```

preset 이 자동 시드: workers (profile) + rule-packs (template required) + skill-packs + quality-contract (placeholder productIntent).

### 3-B. 수동 (전체 14단계 학습용)

```bash
$ mkdir try-nekoforge && cd try-nekoforge
$ git init
$ nekoforge init
[ok] D:\...\try-nekoforge\.harness created.
[next] harness ask "<goal>"
```

`.harness/` 가 본 도구의 단일 사실원. `.claude/`, `.cursor/`, `.codex/` 등은 단방향 export 결과물.

## 3. 첫 verdict (5분)

### 3-1. 목표 + 클리어ify (1분)

```bash
$ harness ask "사용자 로그인 잠금 기능 추가 (5회 실패 시 5분 잠금)"
```

### 3-2. context + spec (1분)

```bash
$ harness context
# 의미: 프로젝트의 파일·언어·스크립트·테스트·위험파일을 자동 스캔해 스냅샷을 만들고, 도메인·제약·관련 파일은 사용자가 보완.

$ harness spec
# 비대화형이면: --non-interactive --answers spec-answers.json
# spec-answers.json 예:
# {
#   "who": "운영자",
#   "why": "탈취 방지",
#   "problemIfMissing": "무차별 대입",
#   "coreFeatures": "5회 실패 + 5분 잠금",
#   "notDoing": "이메일 알림",
#   "successCriteria": "잠금 발동률 99%",
#   "failureCriteria": "오작동 1% 이상"
# }
```

### 3-3. plan + design + policy + team (1분)

```bash
$ harness plan
$ harness design --pattern Pipeline
$ harness policy
$ harness team
```

### 3-4. packet + quality-contract + workers + rule-packs (1분)

```bash
$ harness contract --template web-ui --task TASK-001
$ harness workers init --profile standard
$ harness packet TASK-001 --dispatch  # AI 작업 패킷 + worker prompt 생성
$ harness rule-pack audit       # 기본 enabled pack 5개 자동 생성
$ harness skill-pack audit
```

### 3-5. work + review + gate (1분)

```bash
# 사용자가 실제 코드 변경 작성 (IDE / AI 사용)
# 예: src/auth/login.ts 에 lockout 로직 추가

$ harness work TASK-001
$ harness review                # adapter 없으면 self-review 만
$ harness gate
```

출력 예:

```
[verdict] PASS_WITH_WARNINGS
[rules]   no-test-risk
[next]    review REPORT.md → harness apply --approved
```

## 4. 결과 해석 (1분)

`.harness/decision.json` 의 핵심 필드:

```json
{
  "verdict": "PASS_WITH_WARNINGS",
  "deterministicRules": { "status": "passed", "triggeredRules": ["no-test-risk"] },
  "qualityContract": { "status": "valid", "failedBars": [] },
  "qualityScore": { "overall": 92, "status": "passed" },
  "workerFactory": { "status": "missing", "missingWorkers": [...] },
  "rulePacks": { "status": "complete" },
  "apply": { "allowed": true, "reason": "verdict permits apply" }
}
```

`REPORT.md` 는 사람이 읽는 종합 보고서. 검토 후:

## 5. Apply (1분)

```bash
$ harness apply --approved
[ok] apply permitted (verdict + approval ok)
```

verdict 가 `NEEDS_HUMAN_REVIEW` 면 `.harness/approval.txt` 에 토큰 한 줄 필요:

```text
approve TASK-001 verdict=NEEDS_HUMAN_REVIEW decision=<current-decision-hash12> by=<name> at=<iso-time>
```

verdict 가 `BLOCK` 또는 `INSUFFICIENT_EVIDENCE` 면 **어떤 플래그로도** apply 불가. 원인을 해결하고 다시 gate.

## 6. 단축 흐름

위 전체 흐름을 자동화:

```bash
$ harness self-host --goal "(목표)"
# tmpdir 격리 워크스페이스에서 14단계 자동 실행, 결과 보고.
```

또는 자가 정직성 검증용:

```bash
$ harness self-host --with-worker-stubs
# 3 worker (impl/test/sec) result 도 stub 으로 시드.
```

## 7. 자주 막히는 곳

| 증상 | 원인 | 해결 |
|---|---|---|
| `quality-contract.json missing` 으로 work 거부 | contract 단계 누락 | `harness contract --template <…> --task <id>` |
| `pre-tool hook "ts-typecheck" failed: exit=?` | Windows + .cmd 문제 | v0.5+ 에서 해결 (`resolveExecutable`) |
| `verdict=NEEDS_HUMAN_REVIEW; approval.txt missing` | approval token 없음 | `.harness/approval.txt` 에 한 줄 추가 |
| `rule-pack-missing` finding | template 에 required pack 비활성 | `harness rule-pack enable <pack>` |
| `worker-role-separation` | 같은 worker.id 가 impl+security 보유 | workers.json 의 id 분리 |

## 8. 다음 읽을 것

- [README.md](README.md) — 6 핵심 가치
- [docs/PRODUCT.md](docs/PRODUCT.md) — 무엇을 위한 도구인가
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — 14단계 상세 흐름
- [docs/CLI.md](docs/CLI.md) — 29 명령 도움말
- [docs/SECURITY.md](docs/SECURITY.md) — 위협 모델
- [examples/](examples/) — 10개 시나리오 + self-host 8회 기록
