/**
 * ⓒ 증거 무결성 — content hash + audit chain anchoring.
 *
 * decision.json 의 canonical(키 정렬) sha256 을 산출해 gate_verdict audit 이벤트에
 * `decisionHash` 로 박는다. apply 는 decision 을 다시 해싱해 audit 에 박힌 값과 대조한다.
 * decision.json 본문을 사후 편집하면 해시가 어긋나 apply 가 거부한다.
 * 공격자가 audit 의 decisionHash 까지 바꾸려면 audit chain(line_hash) 이 깨진다.
 *
 * HMAC(키 필요) 대신 content-hash + chain anchoring 을 쓴다 — 로컬-first 도구라
 * 키 관리 부담 없이 기존 sha256 chain 인프라를 재사용한다.
 */
import { createHash } from "node:crypto";

/** 값을 키 정렬된 결정론적 문자열로 직렬화한다(배열 순서는 유지). */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]))
      .join(",") +
    "}"
  );
}

/** decision 등 임의 객체의 canonical sha256(64자 hex). 키 순서에 독립적이다. */
export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

/**
 * audit.jsonl 텍스트에서 가장 마지막 gate_verdict 라인의 decisionHash 를 꺼낸다.
 * decisionHash 를 실은 gate_verdict 가 하나도 없으면 null(legacy/구버전 gate).
 */
export function extractLastDecisionHash(auditText: string): string | null {
  const lines = auditText.split("\n").filter((l) => l.length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]!) as {
        type?: string;
        decisionHash?: string;
      };
      if (parsed.type === "gate_verdict" && typeof parsed.decisionHash === "string") {
        return parsed.decisionHash;
      }
    } catch {
      // 깨진 라인은 건너뛴다(chain 검증은 별도 책임).
    }
  }
  return null;
}
