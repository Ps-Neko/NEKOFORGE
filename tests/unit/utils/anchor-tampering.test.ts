/**
 * 2,7 — audit anchor 위변조 감지 강화.
 *
 * 7: 이전 anchor 의 lastHash 가 현재 chain 에 보존돼야 한다(append-only).
 *    chain 을 통째 재계산하면 prev.lastHash 가 사라져 감지된다.
 * 2: anchor 파일이 없는데 chain 에 이전 gate_verdict 가 있으면 anchor 삭제 의심.
 *
 * 둘 다 prevAnchor 또는 prior gate_verdict 가 있을 때만 발화 → 정상 첫 실행 무영향.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAnchorTampering, type AuditAnchor } from "../../../src/utils/audit.js";

function anchor(lastHash: string | null): AuditAnchor {
  return {
    schemaVersion: "0.3",
    lineCount: 3,
    firstHash: "first",
    lastHash,
    recordedAt: "2026-05-24T00:00:00Z"
  };
}

test("detectAnchorTampering: no prev anchor + no prior gate_verdict → null (정상 첫 실행)", () => {
  assert.equal(
    detectAnchorTampering(null, '{"type":"command_start"}\n'),
    null
  );
});

test("detectAnchorTampering: anchor missing but prior gate_verdict exists → tamper (anchor 삭제)", () => {
  const r = detectAnchorTampering(
    null,
    '{"type":"command_start"}\n{"type":"gate_verdict","verdict":"PASS"}\n'
  );
  assert.match(r ?? "", /anchor (missing|deleted)/i);
});

test("detectAnchorTampering: prev lastHash preserved in chain → null (정상 append)", () => {
  assert.equal(
    detectAnchorTampering(anchor("abc123"), 'x\n{"line_hash":"abc123"}\nmore\n'),
    null
  );
});

test("detectAnchorTampering: prev lastHash absent → tamper (chain 재작성)", () => {
  const r = detectAnchorTampering(anchor("abc123"), '{"line_hash":"zzz999"}\n');
  assert.match(r ?? "", /rewritten|absent/i);
});
