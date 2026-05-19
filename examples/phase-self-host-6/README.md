# Self-host #6 — Codex review #3 + Beta 조건 #2/#3 결과 자가 검증

> Codex review #3 5건 (Critical 2 + Major 2 + Medium 1) 처리 + Beta 진입 조건 #2 (FP 5개 fixture) + #3 (rule 17 memory) 직후, 본 도구로 본 작업 14단계를 회수해 자가 검증한 결과.

## 실행 흐름 (2026-05-19)

```text
init → ask → context → spec(non-interactive --answers) → plan → design(Pipeline)
  → policy → team → contract(custom) → work(TASK-001) → review → gate → apply
```

## 결과

| 단계 | 상태 | 비고 |
|---|---|---|
| init~team | ok | 정상 진행 |
| contract | ok | template=custom, 3 answer (user/problem/coreValue) |
| work | ok (재시도 후) | **1차: pre-tool/ts-typecheck hook 실패 (Windows .cmd 해상도)**. hooks.json 을 internal:noop 로 덮어 2차 통과 |
| review | ok | adapters=0, status=not_run |
| gate | **verdict=NEEDS_HUMAN_REVIEW** | failedBars: `correctness:70<80`, `testCoverage:40<70` |
| apply | **exit 3 (ApplyApprovalError)** | approval.txt 부재로 거부 |

## 의도된 약속 발화 (양호한 신호)

1. **failedBars 강등**: quality-contract 의 qualityBars 가 충족되지 않아 verdict 가 자동 PASS 되지 않고 NEEDS_HUMAN_REVIEW 로 강등됨.
2. **Evidence before Apply + approval token 강제**: verdict=NEEDS_HUMAN_REVIEW 상태에서 apply 가 approval.txt 부재로 차단됨 (Codex review #3 #1 의 직접 검증).
3. **deterministic rule 18종 모두 미발화**: 본 작업이 보안 패턴/구조 위반/디자인 위반 어느 것도 도입하지 않았다는 양성 확인.
4. **decision.json schemaVersion 0.4**: Codex review #3 #5 갱신 결과 자체가 self-host 산출물에서 검증.

## 실제 결함 발견 (self-host 의 진짜 가치)

**Windows 의 hook runner 결함**:
- `defaultExecutor` 가 `spawnSync(shell:false)` 로 `npx tsc --noEmit` 실행 시 status=null (exit=?) 로 실패.
- 원인 1: Windows 에서 `npx`, `npm` 은 `.cmd` 파일이며 PATHEXT 자동 탐색 미동작.
- 원인 2: Node.js 20+ 의 CVE-2024-27980 fix 가 `.cmd`/`.bat` 을 shell:false 로 실행하는 것을 EINVAL 로 차단.
- eval-case (결함): `windows-cmd-resolution-missed-risk.json`.

**즉시 해결**:
- `resolveExecutable(cmd, platform)` 헬퍼 — Windows 면 npm/npx/yarn/pnpm/deno/bun 에 `.cmd` 부착.
- SPAWN_INJECTOR — `.cmd`/`.bat` 일 때 `cmd.exe /c <resolved> <args...>` 로 우회 (shell:false 정책 유지).
- 보안 안전 근거: isAllowedCommand 가 셸 메타 모두 차단 + args 토큰 분리 + cmd.exe argv 직접 전달.
- 테스트: resolveExecutable 4 단위 테스트 (linux/darwin/win32 + 확장자 보존).
- eval-case (해결): `windows-cmd-resolution-resolved.json`.
- 재시도: `npx tsc --noEmit` hook 이 Windows 에서 정상 통과.

## 다음 회차 입력

본 self-host #6 결과는 다음 외부 Codex 검증 사이클의 사전 신호:
- 본 도구가 본 작업을 자동 PASS 하지 않았다 → 자가 정직성 확인.
- 그러나 Windows 결함 1건 발견 → 다음 회차에서 hook runner 의 .cmd 해상도 추가 처리.

## 부수 산출

- eval-cases 3건: `M-self-host-6-milestone-passed.json`, `quality-contract-failed-bars-useful.json`, `windows-cmd-resolution-missed-risk.json`.
- `.harness/` 디렉터리는 gitignore 로 추적되지 않음 (정상).
