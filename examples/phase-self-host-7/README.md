# Self-host #7 — Phase WF/RP 자가 검증

> Phase WF (Worker Factory) + Phase RP (Rule/Skill Pack) 머지 직후, 본 도구로 본 작업을 회수해 새 약속 (workerFactory / rulePacks / skillPacks) 이 자기 자신에 발화하는지 확인.

## 실행 흐름 (2026-05-20)

```bash
$ harness self-host --goal "self-host #7 — Phase WF/RP 자가 검증"
```

self-host CLI 가 tmpdir 격리 워크스페이스에 14단계 + WF/RP 자동 시드 후 gate 호출.

## 1차 결과 (WF/RP 시드 누락)

| 항목 | 결과 |
|---|---|
| verdict | NEEDS_HUMAN_REVIEW |
| deterministicRules | 모두 미발화 |
| **workerFactory.status** | `missing` ← Phase WF 약속이 본 도구 자신에 발화 |
| **rulePacks.status** | `missing` ← Phase RP 약속 동작 확인 |
| **skillPacks.status** | `missing` ← Phase RP skillpack 동작 확인 |
| failedBars | correctness/testCoverage (기존 신호) |

**의미**: 본 도구의 새 약속 (Phase WF/RP) 이 self-host 명령 자신에도 자동 발화. self-host 가 workers/rule-pack/skill-pack 을 시드하지 않아 "missing" 으로만 잡힘.

## 2차 보강 (self-host 명령에 WF/RP 시드 추가)

```typescript
// src/cli/commands/self-host.ts
await runWorkersInit({ profile: "standard", force: true }, deps);
await ensureRulePacks(deps);
await ensureSkillPacks(deps);
```

| 항목 | 결과 |
|---|---|
| verdict | NEEDS_HUMAN_REVIEW |
| triggered rules | **no-test-risk** + **worker-missing-required** |
| workerFactory | profile=standard, requiredWorkers=[impl, test, sec], completedWorkers=[], missingWorkers=3 |
| rulePacks | enabled=[security-core, test-discipline, architecture-core, quality-contract-core, worker-safety-core] |
| skillPacks | enabled=[typescript-quality, evidence-writing] |

**의미**: 본 도구가 본 작업의 진짜 약점을 잡음:
1. `no-test-risk` — self-host.ts 변경에 동반 테스트 없음 (정확)
2. `worker-missing-required` — workers 정의됐지만 result import 안됨 (정확)

이는 **올바른 자가 정직성** 신호. 본 도구가 본 작업을 자동 PASS 하지 않고 사람 검토 요구.

## 의미적 변화

- self-host #6 까지: deterministic rule + Quality Contract failedBars 만 동작했음.
- self-host #7: Phase WF + Phase RP 의 3 신호 (workerFactory / rulePacks / skillPacks) 가 모두 decision.json 에 기록되고 verdict 에 영향. 본 도구의 **6 약속 (QC, QS, deterministic, architecture, design, worker, rule-pack)** 이 동시 발화.
- self-host 명령 자체가 WF/RP 시드를 자동 호출해 다음 회차에서는 standard profile 기준으로 검증.

## eval-cases

- `worker-missing-required-self-host-useful.json` — Phase WF 약속 발화 확인
- `M-self-host-7-milestone-passed.json` — 회차 통과 기록

## 다음 회차 입력

- worker-result 도 자동 시드하는 self-host 모드 (test-worker / security-reviewer stub) 추가 여지.
- 외부 Codex 에 Phase WF/RP 검증 프롬프트 (NEKOFORGE_Worker_Factory_RulePack_Implementation_Prompt.md §10) 입력.
