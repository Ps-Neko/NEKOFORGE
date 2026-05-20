# EXTERNAL VALIDATION TEMPLATE

> 외부 검증자가 본 도구를 시도한 후 작성하는 양식. PR 또는 GitHub Issue 본문에 그대로 채워 제출.

```text
Project:
Language: (TypeScript / Python / Go / ...)
Repo size: (LOC 추정 또는 sub-package 단위)

Task:
(어떤 변경 / 기능 / 버그 수정에 적용했는가)

Template:
(harness contract --template <name> 의 name)
Worker profile:
(workers init --profile <name>)

Rule packs enabled:
(harness rule-pack list 출력)
Skill packs enabled:
(harness skill-pack list 출력)

---

## verdict

Verdict:
(PASS / PASS_WITH_WARNINGS / NEEDS_HUMAN_REVIEW / BLOCK / INSUFFICIENT_EVIDENCE)
Quality Score overall:
Triggered rules:
Failed quality bars:
Worker Factory status:
Rule Packs status:
Skill Packs status:

---

## 평가

무엇이 유용했는가:
- (구체 사례 1개 이상)

무엇이 noisy 했는가:
- (사용자가 이미 안전하다고 판단했는데 발화한 사례)

False positive:
- (있다면 fixture 후보로 negative case 제안)

False negative:
- (있다면 어떤 패턴을 잡았어야 했는가)

자동 PASS 되지 않은 이유 (요약):
- (NEEDS_HUMAN_REVIEW / BLOCK 인 경우 본 도구가 정확히 잡았는가)

---

## 사용 경험

설치 + init + 첫 verdict 까지 걸린 시간:
(분 단위)

막힌 단계:
(어떤 명령에서 어떤 에러)

해결 방법:
(공식 docs / GETTING-STARTED 의 어느 부분이 도움 됐는가)

다음에도 사용할 의향:
(Yes / Maybe / No + 이유)

---

## 첨부 파일 (PR 또는 issue 에 함께)

- REPORT.md
- .harness/decision.json
- .harness/quality-score.json
- (선택) .harness/worker-result-validation.json
- (선택) .harness/benchmark-report.md

---

## 추가 메모

(본 도구의 정체성 vs 사용자 기대 사이의 gap, 또는 docs 개선 제안)
```

본 양식은 [ALPHA-RECRUITMENT.md](ALPHA-RECRUITMENT.md) 의 검증자 모집 흐름과 짝을 이룬다.
