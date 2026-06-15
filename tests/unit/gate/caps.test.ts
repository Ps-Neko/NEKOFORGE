/**
 * uniqueTriggeredPacks — 모든 카탈로그 팩이 역매핑되는지 회귀 테스트.
 *
 * caps.ts 에 누락된 팩이 있으면 findings 가 있어도 triggeredPacks 에 포함되지
 * 않는다. 이 테스트는 13 카탈로그 팩 전체에 대해 대표 rule 하나씩 firing 했을 때
 * 해당 팩이 반환되는지 검증한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { uniqueTriggeredPacks } from "../../../src/core/gate/caps.js";
import { RULE_PACK_CATALOG } from "../../../src/rule-packs/catalog.js";
import type { RuleFinding } from "../../../src/rules/index.js";

function finding(ruleId: string): RuleFinding {
  return { ruleId, severity: "warning", message: "test" };
}

test("uniqueTriggeredPacks: each catalog pack is reachable via its first rule", () => {
  for (const pack of RULE_PACK_CATALOG) {
    const firstRule = pack.rules[0];
    assert.ok(firstRule, `${pack.id} must have at least one rule`);
    const result = uniqueTriggeredPacks(
      [finding(firstRule)],
      [pack.id]
    );
    assert.ok(
      result.includes(pack.id),
      `pack "${pack.id}" was not triggered by rule "${firstRule}" — missing from uniqueTriggeredPacks`
    );
  }
});

test("uniqueTriggeredPacks: pack not in enabledPacks is never returned", () => {
  const result = uniqueTriggeredPacks(
    [finding("secret-fallback")],
    [] // security-core not enabled
  );
  assert.equal(result.length, 0);
});

test("uniqueTriggeredPacks: multiple packs triggered simultaneously", () => {
  const result = uniqueTriggeredPacks(
    [finding("secret-fallback"), finding("unbounded-version-risk")],
    ["security-core", "dependency-risk"]
  );
  assert.ok(result.includes("security-core"));
  assert.ok(result.includes("dependency-risk"));
  assert.equal(result.length, 2);
});

// 동작 보존(특성화): worker-safety-core 는 catalog '룰' 정의가 아니라 worker 합성 단계
// (phase-synthesis)가 내는 finding id 로 트리거된다. catalog 로 단순 병합하면 이 트리거가
// 사라지므로(회귀), 단일출처화 후에도 worker-phase finding 트리거를 보존해야 한다.
test("uniqueTriggeredPacks: worker-safety-core 는 worker-합성 finding(worker-role-separation)으로도 트리거", () => {
  const result = uniqueTriggeredPacks([finding("worker-role-separation")], ["worker-safety-core"]);
  assert.ok(result.includes("worker-safety-core"), "worker-phase finding 이 worker-safety-core 를 트리거해야 함");
});

// catalog 파생이 first rule 뿐 아니라 pack 의 모든 rule 로 동작하는지(단일출처화 검증).
test("uniqueTriggeredPacks: catalog pack 은 non-first rule 로도 트리거(api-safety via missing-rate-limit-risk)", () => {
  const result = uniqueTriggeredPacks([finding("missing-rate-limit-risk")], ["api-safety"]);
  assert.ok(result.includes("api-safety"));
});
