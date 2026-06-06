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
