# FACTORY CELLS — Phase QF

> 버전 0.5 · 2026-05-20 · 14단계 공정을 사용자 친화적으로 6 cell 로 묶은 표면.

14단계는 내부 공정이고, 사용자는 6 Factory Cell 로 이해하면 된다.

## 6 Cell 매핑

| Cell | 포함 단계 | 책임 |
|---|---|---|
| **Product Cell** | clarify · spec · intake | "무엇을 만들지" 묻기 |
| **Architecture Cell** | context · harness-design | 구조 잡기 |
| **Build Cell** | plan · team · work | 작업하기 |
| **Quality Cell** | quality-policy · quality-contract · quality-score | 품질 계약·점수 관리 |
| **Review Cell** | self-review · codex-review · architecture-review · design-review | 독립 검토 |
| **Gate Cell** | gate · apply | 출고 막거나 승인 |
| (Memory Cell) | memory · eval-cases · benchmark feedback | 학습 적재 (부속) |

## decision.json 의 factoryCells

각 cell 의 상태 :

| 상태 | 의미 |
|---|---|
| `complete` | 모든 포함 단계의 산출물 존재 |
| `partial` | 일부만 존재 (예: plan 만, team/work 미수행) |
| `missing` | 시작 안 됨 |

## 사용 패턴

```text
Product Cell    → "무엇" 질문
Architecture    → "어떤 구조"
Build           → "어떻게 작은 단위로"
Quality         → "어떤 품질 기준"
Review          → "안전한가" (독립)
Gate            → "출고 가능?"
```

본 매핑은 표면만 정돈한다 — 내부 14단계 자체는 그대로 유지된다.
