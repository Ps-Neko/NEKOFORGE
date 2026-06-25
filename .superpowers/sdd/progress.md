# demo auto — SDD 진행 원장
베이스: 0ce6e5b (feat/demo-auto)
계획: docs/superpowers/plans/2026-06-25-nekoforge-demo-auto.md

- 대기: Task 1~5
Task 1: complete (commits 0ce6e5b..9e6c53a, review clean)
  Minor(최종리뷰 회부): replay-adapter.test.ts:17 'length>0' → /\S/ 가 의도 더 명확(현재 리스크 없음)
Task 2: complete (commits 9e6c53a..19d8697, review→fix 적용: sandbox 누수 try/finally + spentUsd===0.2)
  편차(인정): maxCostUsd 0→0.2 (runAuto review단계 assertCanSpend(0.2) 강제, 재생은 codex-stub라 실과금 0)
  verdict 실출력=NEEDS_HUMAN_REVIEW (엔진 라이브, I1 준수). → 'Humans decide' 데모에 적합
  Task 3로 이월(리뷰 Important1/Minor4): registerDemo action 'auto' 분기 + description 갱신
Task 3: complete (commits 19d8697..974926b, review clean — auto 라우팅 버그 해소, I3/I4 충족, 스모크 verdict=NEEDS_HUMAN_REVIEW+룰4)
  Minor(최종리뷰): (a) --real 모드 [work]/[review] 내레이션이 runAuto 후 출력=라이브 진행표시 부재(브리프 명시 순서); (b) [next] 'nekoforge apply --approved' 문구 실제 명령/플래그와 일치하는지 확인
Task 4: complete (commit 16e7daa, 754/754 — I2 격리 가드 test-only, 직접검증)
Task 5: 보류(DEFERRED) — 라이브 캡처는 claude+codex 인증+실 API 과금 필요(외부) + --real 샌드박스 시드(git init+소스) 미완(plan §8). 오프라인 데모(Task1~4)는 완결. 사용자 결정 대기.
