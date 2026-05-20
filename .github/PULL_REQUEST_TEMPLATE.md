## 요약

<!-- 1-2 문장. 무엇이 어떻게 바뀌었는가. -->

## 자가 검증 (필수)

본 도구로 본 PR 을 회수한 결과:

```bash
$ harness self-host --goal "<PR 설명>"
[verdict] <PASS | PASS_WITH_WARNINGS | NEEDS_HUMAN_REVIEW>
[rules]   <triggered rule list>
```

- [ ] `npm run verify` 통과 (typecheck + lint + depcheck + test)
- [ ] `npm run benchmark` 통과 (recall ≥ 0.8 if release)
- [ ] verdict 가 `BLOCK` / `INSUFFICIENT_EVIDENCE` 가 아님
- [ ] 의도되지 않은 critical rule 발화 없음
- [ ] `dependency-cruiser` 위반 0건 (`no-cross-stage-core` 등)

## 정체성 self-check

본 PR 이 [docs/PRODUCT.md](../docs/PRODUCT.md) 정체성 또는 [ROADMAP §8 영구 비-목표](../docs/ROADMAP.md#8-영구-비-목표) 와 충돌하지 않는다는 한 줄 근거:

<!-- 예: "본 변경은 deterministic 휴리스틱 추가이므로 §8 비-목표 어떤 항목과도 충돌하지 않음." -->

## breaking change

- [ ] 없음
- [ ] 있음 — `RELEASE-NOTES.md` 갱신 + migration note 포함

## 관련 Issue / Discussion

<!-- Closes #N -->
