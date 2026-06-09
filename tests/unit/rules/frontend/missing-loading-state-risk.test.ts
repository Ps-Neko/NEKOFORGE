import { test } from "node:test";
import assert from "node:assert/strict";
import { missingLoadingStateRiskRule } from "../../../../src/rules/frontend/missing-loading-state-risk.js";
import { fc, diffOf, mockCtx } from "../_helpers.js";

const RULE_ID = "missing-loading-state-risk";

// TP: tsx 에 await fetch 추가 + loading state 표현 없음 → info 발화
test("missing-loading-state-risk: await fetch in tsx without loading state triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/components/UserList.tsx", {
        status: "added",
        addedLines: [
          "useEffect(() => {",
          "  const data = await fetch('/api/users');",
          "  setUsers(data);",
          "}, []);"
        ]
      })
    ])
  });
  const out = await missingLoadingStateRiskRule.run(ctx);
  assert.ok(
    out.some((f) => f.ruleId === RULE_ID && f.severity === "info"),
    "expected an info finding for fetch without loading state"
  );
});

// TP: axios. 도 FETCH_RE 에 잡힘 (jsx)
test("missing-loading-state-risk: axios call in jsx without loading state triggers info", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/widgets/Chart.jsx", {
        addedLines: ["const res = await axios.get('/api/chart');"]
      })
    ])
  });
  const out = await missingLoadingStateRiskRule.run(ctx);
  const finding = out.find((f) => f.ruleId === RULE_ID);
  assert.ok(finding, "expected a finding");
  assert.equal(finding!.severity, "info");
  assert.equal(finding!.file, "src/widgets/Chart.jsx");
});

// TN: fetch + isLoading state 표현이 같은 added 블록에 있음 → 미발화
test("missing-loading-state-risk: fetch with isLoading state is clean (no finding)", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/components/UserList.tsx", {
        addedLines: [
          "const [isLoading, setIsLoading] = useState(false);",
          "useEffect(() => {",
          "  setIsLoading(true);",
          "  const data = await fetch('/api/users');",
          "  setIsLoading(false);",
          "}, []);"
        ]
      })
    ])
  });
  const out = await missingLoadingStateRiskRule.run(ctx);
  assert.equal(
    out.filter((f) => f.ruleId === RULE_ID).length,
    0,
    "loading state present → must not fire"
  );
});

// TN: tsx/jsx 가 아닌 .ts 파일은 fetch 가 있어도 스킵
test("missing-loading-state-risk: non-tsx/jsx file is skipped", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/api/client.ts", {
        addedLines: ["const data = await fetch('/api/users');"]
      })
    ])
  });
  const out = await missingLoadingStateRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// TN: fetch 류 토큰 없는 순수 UI 변경 → 미발화
test("missing-loading-state-risk: pure markup change without fetch is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/components/Header.tsx", {
        addedLines: ["return <header className='top'>Title</header>;"]
      })
    ])
  });
  const out = await missingLoadingStateRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// 경계: deleted 상태 파일은 fetch 가 있어도 스킵
test("missing-loading-state-risk: deleted tsx file is skipped even with fetch", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/components/Old.tsx", {
        status: "deleted",
        addedLines: ["const data = await fetch('/api/x');"]
      })
    ])
  });
  const out = await missingLoadingStateRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});

// 경계: useQuery 는 FETCH_RE 에 잡히지만, "loading" 토큰이 같은 added 에 있으면 미발화.
// LOADING_RE 는 단어 \b loading 만으로도 매칭하므로 isLoading 구조분해 destructure 도 가드로 인정된다.
test("missing-loading-state-risk: useQuery with destructured loading flag is clean", async () => {
  const ctx = mockCtx({
    diff: diffOf([
      fc("src/components/Posts.tsx", {
        addedLines: [
          "const { data, isLoading } = useQuery(['posts'], fetchPosts);"
        ]
      })
    ])
  });
  const out = await missingLoadingStateRiskRule.run(ctx);
  assert.equal(out.filter((f) => f.ruleId === RULE_ID).length, 0);
});
