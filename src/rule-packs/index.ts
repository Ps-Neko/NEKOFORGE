/**
 * Rule pack management (Phase RP).
 *
 * .harness/rule-packs.json 의 enabled/required 관리.
 */
import type { StageDeps } from "../core/stage-runner.js";
import { RULE_PACK_CATALOG, findRulePack } from "./catalog.js";

export interface RulePacksJson {
  schemaVersion: "0.5";
  enabledPacks: string[];
  disabledPacks?: string[];
  requiredForTemplates?: Record<string, string[]>;
}

const DEFAULT_TEMPLATE_REQUIRED: Record<string, string[]> = {
  "web-ui": [
    "security-core",
    "design-web",
    "test-discipline",
    "quality-contract-core"
  ],
  "backend-api": [
    "security-core",
    "architecture-core",
    "test-discipline",
    "release-strict",
    "quality-contract-core"
  ],
  "cli-tool": [
    "security-core",
    "test-discipline",
    "architecture-core",
    "quality-contract-core"
  ],
  library: [
    "architecture-core",
    "test-discipline",
    "release-strict",
    "quality-contract-core"
  ]
};

const DEFAULT_ENABLED = [
  "security-core",
  "test-discipline",
  "architecture-core",
  "quality-contract-core",
  "worker-safety-core"
];

export class RulePackError extends Error {
  readonly exitCode = 10;
  constructor(msg: string) {
    super(msg);
    this.name = "RulePackError";
  }
}

export async function readRulePacks(
  deps: StageDeps
): Promise<RulePacksJson | null> {
  return deps.artifact
    .readJson<RulePacksJson>("rule-packs.json", "rule-packs")
    .catch(() => null);
}

export async function ensureRulePacks(
  deps: StageDeps
): Promise<RulePacksJson> {
  const existing = await readRulePacks(deps);
  if (existing) return existing;
  const init: RulePacksJson = {
    schemaVersion: "0.5",
    enabledPacks: [...DEFAULT_ENABLED],
    disabledPacks: [],
    requiredForTemplates: { ...DEFAULT_TEMPLATE_REQUIRED }
  };
  await deps.artifact.writeJson("rule-packs.json", init, "rule-packs");
  return init;
}

export async function enableRulePack(
  packId: string,
  deps: StageDeps
): Promise<RulePacksJson> {
  if (!findRulePack(packId)) {
    throw new RulePackError(`unknown rule pack: ${packId}`);
  }
  const cur = await ensureRulePacks(deps);
  const enabled = new Set(cur.enabledPacks);
  const disabled = new Set(cur.disabledPacks ?? []);
  enabled.add(packId);
  disabled.delete(packId);
  const next: RulePacksJson = {
    ...cur,
    enabledPacks: [...enabled],
    disabledPacks: [...disabled]
  };
  await deps.artifact.writeJson("rule-packs.json", next, "rule-packs");
  return next;
}

/**
 * pack 을 disabled 로 표시(rule-packs.json 갱신).
 * ⚠️ 이 토글은 **룰 실행을 멈추지 않는다** — 모든 결정적 룰은 계속 실행되고 finding 도 그대로 난다
 * (게이트 보수성: 룰이 더 도는 쪽이 더 엄격). 끄기는 '트리거된 pack' 보고 범위와 필수 pack 정책에만
 * 반영된다. 룰을 실제로 안 돌리려면 phase-rules 에 enabledRules 필터 배선이 필요하다(현재 미구현).
 */
export async function disableRulePack(
  packId: string,
  deps: StageDeps
): Promise<RulePacksJson> {
  const cur = await ensureRulePacks(deps);
  const enabled = new Set(cur.enabledPacks);
  const disabled = new Set(cur.disabledPacks ?? []);
  enabled.delete(packId);
  disabled.add(packId);
  const next: RulePacksJson = {
    ...cur,
    enabledPacks: [...enabled],
    disabledPacks: [...disabled]
  };
  await deps.artifact.writeJson("rule-packs.json", next, "rule-packs");
  return next;
}

export interface RulePackStatus {
  configured: boolean;
  enabledPacks: string[];
  disabledPacks: string[];
  templateRequirements: Record<string, string[]>;
  unknownEnabled: string[];
}

export async function getRulePackStatus(
  deps: StageDeps
): Promise<RulePackStatus> {
  const r = await readRulePacks(deps);
  if (!r) {
    return {
      configured: false,
      enabledPacks: [],
      disabledPacks: [],
      templateRequirements: { ...DEFAULT_TEMPLATE_REQUIRED },
      unknownEnabled: []
    };
  }
  const unknown = r.enabledPacks.filter((p) => !findRulePack(p));
  return {
    configured: true,
    enabledPacks: [...r.enabledPacks],
    disabledPacks: [...(r.disabledPacks ?? [])],
    templateRequirements:
      r.requiredForTemplates ?? { ...DEFAULT_TEMPLATE_REQUIRED },
    unknownEnabled: unknown
  };
}

export function listRulePackCatalog(): readonly { id: string; describe: string }[] {
  return RULE_PACK_CATALOG.map((p) => ({ id: p.id, describe: p.describe }));
}
