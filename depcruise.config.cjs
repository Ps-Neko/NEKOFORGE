/**
 * dependency-cruiser config — ARCHITECTURE.md §7 모듈 의존성 규칙 강제.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    },
    {
      name: "no-cross-stage-core",
      comment:
        "core/<stage> 끼리 직접 import 금지. 단계간 통신은 artifact 파일을 통해서만. " +
        "단, auto/ 와 prepare/ 는 오케스트레이터이므로 모든 stage 를 조합 허용. " +
        "promotion/ 은 채용된 rule 의 공유 소스(leaf)이므로 어떤 stage(예: gate 의 런타임 채용 합류)든 읽을 수 있다 — promotion 은 다른 core stage 를 import 하지 않아 순환 없음. " +
        "source-map/ 도 프로젝트 스냅샷 leaf 이므로 다른 stage(예: context 의 source artifact 생성)가 import 할 수 있다 — source-map 은 다른 core stage 를 import 하지 않아 순환 없음.",
      severity: "error",
      from: {
        path: "^src/core/([^/]+)/",
        pathNot: "^src/core/(auto|prepare)/"
      },
      to: {
        path: "^src/core/([^/]+)/",
        pathNot: "^src/core/($1|promotion|source-map)/"
      }
    },
    {
      name: "no-rule-to-integration",
      comment: "deterministic rule 은 외부 도구에 의존하지 않는다.",
      severity: "error",
      from: { path: "^src/rules/" },
      to: { path: "^src/integrations/" }
    },
    {
      name: "no-rule-to-hooks",
      comment: "rule 은 hook 에 의존하지 않는다.",
      severity: "error",
      from: { path: "^src/rules/" },
      to: { path: "^src/hooks/" }
    },
    {
      name: "no-artifact-to-core",
      comment: "artifact 는 단방향. core 를 모른다.",
      severity: "error",
      from: { path: "^src/artifact/" },
      to: { path: "^src/(core|cli)/" }
    },
    {
      name: "no-utils-to-core",
      comment: "utils 는 단방향. core/cli 를 모른다.",
      severity: "error",
      from: { path: "^src/utils/" },
      to: { path: "^src/(core|cli|rules|hooks|integrations)/" }
    },
    {
      name: "no-integration-to-core",
      comment: "integration adapter 는 core 를 모른다.",
      severity: "error",
      from: { path: "^src/integrations/" },
      to: { path: "^src/core/" }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json"
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["module", "main", "types", "typings"]
    },
    reporterOptions: {
      text: { highlightFocused: true }
    }
  }
};
