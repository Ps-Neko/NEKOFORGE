# Codex Review Request — NEKOFORGE Phase WF/RP (v0.5.0-alpha)

> 외부 Codex 에 본 파일 통째로 입력. 응답을 `.review-requests/codex-review-v0.5.response.md` 에 저장 후 본 AI 에게 전달.

---

## 검증 대상

- 레포: `Ps-Neko/NEKOFORGE` (private)
- 브랜치: `main`
- 커밋: `1a8975f` (HEAD)
- 버전: `v0.5.0-alpha`
- 본 회차의 작업 범위: Phase WF (Worker Factory) + Phase RP (Rule/Skill Pack)

## 검증 프롬프트

```
You are reviewing this repository as an independent safety and architecture reviewer.

Focus on serious issues only. Return critical findings, high-risk findings, missing tests, architecture concerns, minimal fixes, and a final verdict (PASS / PASS_WITH_WARNINGS / NEEDS_HUMAN_REVIEW / BLOCK).

Check these 15 items:

1. Can any worker write decision.json? (gate must be the only writer)
2. Can any worker apply, commit, push, or deploy?
3. Is implementation-worker separated from security-reviewer in workers.json roleSeparation?
4. Are worker results stored only under .harness/worker-runs/<task>/<role>.result.{md,json} ?
5. Does gate read worker evidence and reflect it in decision.json.workerFactory?
6. Does missing required worker evidence lower verdict?
7. Does a worker critical finding lead to BLOCK?
8. Are rule packs actually connected to gate, or only documented?
9. Does missing required rule pack result in INSUFFICIENT_EVIDENCE?
10. Does skill-pack missing avoid direct BLOCK but produce warning/review as intended?
11. Does release mode require release-strict and benchmark smoke?
12. Are Quality Contract and Quality Score still mandatory?
13. Can BLOCK or INSUFFICIENT_EVIDENCE still be applied through any path?
14. Is .harness still the source of truth (.claude/.cursor/.codex are export-only)?
15. Did the implementation become a bloated OMC/ECC clone instead of NEKOFORGE-style controlled factory?

Additional context — please verify these specific design decisions made in v0.5:

- Workers/rule-packs/skill-packs were moved to `src/workers/`, `src/rule-packs/`, `src/skill-packs/` (leaf dirs, NOT under src/core/) to satisfy dependency-cruiser's no-cross-stage-core rule. Is this the right place, or should they be promoted to first-class core stages?

- detectForbiddenActions scans worker result body for patterns like "git push", "decision.json", "harness apply", "kubectl apply", "audit.jsonl". Any false-positive risk in legitimate context (e.g., a worker explaining why NOT to do something)?

- Self-host #7 (commit 8739891) was the AI running NEKOFORGE on its own diff right after WF/RP merge. verdict came back NEEDS_HUMAN_REVIEW with no-test-risk + worker-missing-required firing. Is this the right level of self-honesty?

- 8 rule packs + 7 skill packs is a curated catalog. Did we accidentally drift toward an ECC-like marketplace? Or is the curation tight enough?

Return your review in the following structure:

## Summary
<1-2 sentence overall judgment>

## Critical findings
- ...

## High-risk findings
- ...

## Missing tests
- ...

## Architecture concerns
- ...

## Minimal fixes
- ...

## Final verdict
<PASS | PASS_WITH_WARNINGS | NEEDS_HUMAN_REVIEW | BLOCK>
```

## 첨부할 context (외부 Codex 가 본 레포 접근 가능 시 생략)

만약 외부 Codex 가 GitHub 접근 가능하면 위 프롬프트만으로 충분. 접근 불가하면 다음 5 파일을 본 프롬프트에 첨부:

1. `README.md`
2. `RELEASE-NOTES.md` (v0.5 entry)
3. `docs/WORKER-FACTORY.md`
4. `docs/WORKER-SAFETY.md`
5. `docs/RULE-PACKS.md`
6. `docs/SKILL-PACKS.md`
7. `src/core/gate/index.ts` (WF/RP 통합 핵심)
8. `src/workers/validate.ts` (role separation + forbidden action)

## 응답 처리

외부 Codex 응답을 받으면:

1. `.review-requests/codex-review-v0.5.response.md` 에 저장.
2. 본 AI 에게 "Codex review 결과 도착" 알리기.
3. 본 AI 가 Critical / High 항목 즉시 대응.
4. self-host #N+1 로 대응 결과 회수.

이전 사이클 (Codex review #1, #2, #3) 모두 이 절차를 따랐음.
