/**
 * 보안 룰용 AST 보강 스캐너 — 정규식이 놓치는 우회를 잡는다.
 *
 * 설계 원칙: **정규식을 대체하지 않고 보강한다.** 룰은 기존 정규식을 먼저 돌리고,
 * 그 위에 본 AST 스캔을 더한 뒤 (file,line,ruleId) 로 dedup 한다. 파싱 불가능한
 * diff 조각은 그냥 건너뛰므로(정규식이 이미 처리) 탐지가 절대 후퇴하지 않는다.
 *
 * diff 의 addedLines 만 본다. 우선 전체 블록을 파싱하고, 실패하면(조각 경계로
 * 문법이 깨진 경우) 라인 단위로 파싱한다. 두 경로 모두 원본 addedLines 인덱스(1-based)
 * 와 정렬된 line 번호를 만든다(정규식의 idx+1 과 동일 → dedup 시 자연히 합쳐진다).
 */
import { parse } from "acorn";
import type { RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

type Node = { type: string; loc?: { start?: { line?: number } } } & Record<
  string,
  unknown
>;

function asNode(v: unknown): Node | undefined {
  if (v && typeof v === "object" && typeof (v as { type?: unknown }).type === "string") {
    return v as Node;
  }
  return undefined;
}

function tryParse(code: string): Node | undefined {
  try {
    return parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowSuperOutsideMethod: true
    }) as unknown as Node;
  } catch {
    return undefined;
  }
}

interface Located {
  node: Node;
  /** addedLines 기준 1-based 라인(정규식 idx+1 과 정렬). */
  line: number;
}

/** addedLines 를 파싱해 모든 노드를 (원본 라인 정렬된) 형태로 방문 가능하게 만든다. */
function locatedNodes(addedLines: string[]): Located[] {
  const sources: Array<{ prog: Node; offset: number }> = [];
  const whole = tryParse(addedLines.join("\n"));
  if (whole) {
    sources.push({ prog: whole, offset: 0 });
  } else {
    addedLines.forEach((ln, idx) => {
      const p = tryParse(ln);
      if (p) sources.push({ prog: p, offset: idx });
    });
  }
  const out: Located[] = [];
  for (const { prog, offset } of sources) {
    walk(prog, (n) => {
      const l = n.loc?.start?.line;
      out.push({ node: n, line: (l ?? 1) + offset });
    });
  }
  return out;
}

function walk(node: unknown, visit: (n: Node) => void): void {
  const n = asNode(node);
  if (!n) return;
  visit(n);
  for (const key of Object.keys(n)) {
    if (key === "type" || key === "loc" || key === "start" || key === "end" || key === "range") {
      continue;
    }
    const child: unknown = n[key];
    if (Array.isArray(child)) {
      for (const c of child) walk(c, visit);
    } else {
      walk(child, visit);
    }
  }
}

// ── 정적 평가 ────────────────────────────────────────────────────────────────

/** 노드가 정적으로 결정 가능한 원시값이면 박싱해서 반환(아니면 undefined). */
function staticPrimitive(n: Node | undefined): { value: unknown } | undefined {
  if (!n) return undefined;
  switch (n.type) {
    case "Literal":
      return { value: n.value };
    case "UnaryExpression": {
      const arg = staticPrimitive(asNode(n.argument));
      if (!arg) return undefined;
      switch (n.operator) {
        case "!":
          return { value: !arg.value };
        case "-":
          return typeof arg.value === "number" ? { value: -arg.value } : undefined;
        case "+":
          return typeof arg.value === "number" ? { value: +arg.value } : undefined;
        case "typeof":
          return { value: typeof arg.value };
        default:
          return undefined;
      }
    }
    case "BinaryExpression": {
      const l = staticPrimitive(asNode(n.left));
      const r = staticPrimitive(asNode(n.right));
      if (!l || !r) return undefined;
      const a = l.value;
      const b = r.value;
      switch (n.operator) {
        case "===":
          return { value: a === b };
        case "!==":
          return { value: a !== b };
        case ">":
          return { value: (a as number) > (b as number) };
        case "<":
          return { value: (a as number) < (b as number) };
        case ">=":
          return { value: (a as number) >= (b as number) };
        case "<=":
          return { value: (a as number) <= (b as number) };
        case "+":
          return { value: (a as number) + (b as number) };
        case "-":
          return { value: (a as number) - (b as number) };
        case "*":
          return { value: (a as number) * (b as number) };
        default:
          return undefined;
      }
    }
    case "LogicalExpression": {
      const l = staticPrimitive(asNode(n.left));
      if (!l) return undefined;
      if (n.operator === "&&") {
        return l.value ? staticPrimitive(asNode(n.right)) : { value: l.value };
      }
      if (n.operator === "||") {
        return l.value ? { value: l.value } : staticPrimitive(asNode(n.right));
      }
      if (n.operator === "??") {
        return l.value === null || l.value === undefined
          ? staticPrimitive(asNode(n.right))
          : { value: l.value };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/** test 표현식이 정적으로 항상 참이면 true(아니면 undefined/false). */
function staticTruthy(n: Node | undefined): boolean {
  const p = staticPrimitive(n);
  return p !== undefined && Boolean(p.value);
}

/** 노드가 정적 문자열로 접힐 수 있으면 그 문자열(아니면 undefined). 연결/템플릿 포함. */
function staticString(n: Node | undefined): string | undefined {
  if (!n) return undefined;
  if (n.type === "Literal") {
    return typeof n.value === "string" ? n.value : undefined;
  }
  if (n.type === "TemplateLiteral") {
    const quasis = Array.isArray(n.quasis) ? (n.quasis as unknown[]) : [];
    const expressions = Array.isArray(n.expressions) ? (n.expressions as unknown[]) : [];
    let s = "";
    for (let i = 0; i < quasis.length; i++) {
      const q = quasis[i] as { value?: { cooked?: string; raw?: string } };
      s += q.value?.cooked ?? q.value?.raw ?? "";
      if (i < expressions.length) {
        const part = staticString(asNode(expressions[i]));
        if (part === undefined) return undefined;
        s += part;
      }
    }
    return s;
  }
  if (n.type === "BinaryExpression" && n.operator === "+") {
    const l = staticString(asNode(n.left));
    const r = staticString(asNode(n.right));
    return l !== undefined && r !== undefined ? l + r : undefined;
  }
  return undefined;
}

/** 노드가 `process.env.<X>` 멤버 접근인지. */
function isProcessEnvAccess(n: Node | undefined): boolean {
  if (!n || n.type !== "MemberExpression") return false;
  const obj = asNode(n.object);
  if (!obj || obj.type !== "MemberExpression") return false;
  const base = asNode(obj.object);
  const prop = asNode(obj.property);
  return (
    base?.type === "Identifier" &&
    base.name === "process" &&
    prop?.type === "Identifier" &&
    prop.name === "env"
  );
}

const EXCLUDE_VALUES = new Set(["", "null", "undefined", "true", "false", "TODO", "TBD"]);

// ── 룰별 스캐너 ────────────────────────────────────────────────────────────────

/**
 * `process.env.X || <정적 문자열>` / `?? <정적 문자열>` 형태의 fallback 시크릿.
 * 정규식이 못 잡는 문자열 연결·템플릿을 정적 폴딩으로 잡는다.
 */
export function astSecretFallbackFindings(
  addedLines: string[],
  file: string,
  ruleId: string
): RuleFinding[] {
  const out: RuleFinding[] = [];
  const flag = (literal: string, line: number): void => {
    if (literal.length >= 8 && !EXCLUDE_VALUES.has(literal)) {
      out.push(
        makeFinding(
          ruleId,
          "critical",
          `fallback secret literal after env access: ${literal.slice(0, 4)}…`,
          { file, line }
        )
      );
    }
  };
  for (const { node, line } of locatedNodes(addedLines)) {
    if (node.type === "LogicalExpression") {
      if (node.operator !== "||" && node.operator !== "??") continue;
      if (!isProcessEnvAccess(asNode(node.left))) continue;
      const literal = staticString(asNode(node.right));
      if (literal !== undefined) flag(literal, line);
      continue;
    }
    // 삼항 fallback: `env ? env : "secret"` (직접형) / `!env ? "secret" : env` (부정형).
    // LogicalExpression(||/??) 시맨틱을 그대로 미러 — test 가 env 접근이면 alternate,
    // test 가 env 의 부정(!env)이면 consequent 가 fallback 분기.
    if (node.type === "ConditionalExpression") {
      const test = asNode(node.test);
      if (isProcessEnvAccess(test)) {
        const literal = staticString(asNode(node.alternate));
        if (literal !== undefined) flag(literal, line);
      } else if (
        test?.type === "UnaryExpression" &&
        test.operator === "!" &&
        isProcessEnvAccess(asNode(test.argument))
      ) {
        const literal = staticString(asNode(node.consequent));
        if (literal !== undefined) flag(literal, line);
      }
    }
  }
  return out;
}

/** 정적으로 항상 참인 if 가드(인증 우회) — `if (1===1)`, `if (!false)`, `if (1)` 등. */
export function astAuthBypassFindings(
  addedLines: string[],
  file: string,
  ruleId: string
): RuleFinding[] {
  const out: RuleFinding[] = [];
  for (const { node, line } of locatedNodes(addedLines)) {
    // `if (1===1)` / `if (!false)` 등 정적 항상-참 가드.
    // `true ? next() : requireAuth()` 등 정적 항상-참 삼항 (IfStatement 미러).
    if (node.type !== "IfStatement" && node.type !== "ConditionalExpression") continue;
    if (staticTruthy(asNode(node.test))) {
      out.push(
        makeFinding(ruleId, "critical", "auth bypass pattern: constant-true guard", {
          file,
          line
        })
      );
    }
  }
  return out;
}

/** (file,line,ruleId) 기준 dedup — 정규식과 AST 가 같은 라인을 잡으면 하나로 합친다. */
export function dedupeFindings(findings: RuleFinding[]): RuleFinding[] {
  const seen = new Set<string>();
  const out: RuleFinding[] = [];
  for (const f of findings) {
    const key = `${f.file ?? ""}:${f.line ?? ""}:${f.ruleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
