const test = require("node:test");
const assert = require("node:assert/strict");
const W = require("../src/workspace.js");
const M = require("../src/model.js");
const S = require("../src/message.js");

test("demo accounts are preregistered or selected from a fictional roster", () => {
  const accounts = ["aigerim"];
  assert.equal(W.accountsFrom(accounts)[0].name, "Айгерім М.");
  assert.equal(W.accountsFrom(["aigerim", "aigerim"]).length, 1);
  assert.equal(W.accountsFrom(["arman"]).length, 0);
  assert.equal(W.signIn("customer", "zere", accounts), null);
  assert.equal(W.signIn("analyst", "aigerim", accounts), null);
  assert.deepEqual(W.signIn("customer", "aigerim", accounts), {
    role: "customer",
    id: "aigerim",
  });
  assert.deepEqual(W.restore("analyst", accounts), {
    role: "analyst",
    id: W.employee,
  });
  assert.deepEqual(W.restore("customer", accounts), {
    role: "customer",
    id: W.starter,
  });
  assert.equal(W.restore('{"role":"customer","id":"zere"}', accounts), null);
  assert.equal(W.restore("{", accounts), null);
});

test("demo records retain customer ownership and analyst scope", () => {
  const starter = W.signIn("customer", W.starter, []);
  const newCustomer = W.signIn("customer", "aigerim", ["aigerim"]);
  const analyst = W.signIn("analyst", W.employee, []);
  const legacy = M.seeds(10000000).find((r) => r.flagged);
  const transfer = M.make(
    1049,
    { ...M.scenarios.ordinary, owner: newCustomer.id },
    10000000,
  );
  const edited = M.edit(transfer, M.scenarios.ambiguous, 10000100);
  const held = M.transition(edited, "hold", 10000200);
  assert.equal(W.ownerOf(legacy), W.starter);
  assert.equal(W.allowed(starter, "detail", legacy), true);
  assert.equal(W.allowed(newCustomer, "detail", legacy), false);
  assert.equal(W.allowed(newCustomer, "detail", held), true);
  assert.equal(W.allowed(starter, "detail", held), false);
  assert.equal(W.allowed(analyst, "overview"), false);
  assert.equal(W.allowed(analyst, "case", transfer), false);
  assert.equal(W.allowed(analyst, "case", held), true);
  assert.equal(W.allowed(null, "analyst"), false);
  const report = {
    ...S.make(101, "Назовите код из SMS.", 10000000),
    owner: newCustomer.id,
  };
  const resolved = S.resolve(report, "advised", "patternConcern", 10000001);
  assert.equal(W.allowed(analyst, "message-case", resolved), true);
  assert.equal(W.allowed(starter, "message-detail", resolved), false);
  assert.equal(W.allowed(newCustomer, "message-detail", resolved), true);
  const summary = S.summary(101, report.text, null, 10000000);
  assert.equal(S.validSummaries([summary]), true);
  assert.equal(S.validSummaries([{ ...summary, owner: newCustomer.id }]), true);
});

test("theme follows the system unless an appearance is selected", () => {
  assert.equal(W.themeMode(null), "light");
  assert.equal(W.themeMode("invalid"), "light");
  assert.equal(W.effectiveTheme("system", false), "light");
  assert.equal(W.effectiveTheme("system", true), "dark");
  assert.equal(W.effectiveTheme("dark", false), "dark");
  assert.equal(W.effectiveTheme("light", true), "light");
});

test("the rules brief adapts to evidence and does not change decisions", () => {
  const transfer = M.make(1049, M.scenarios.suspicious, 100);
  const summary = (r) =>
    W.caseBrief(r, {
      signals: M.assess(r).signals,
      weights: M.weights,
      attested: M.verification(r)?.event === "answer",
      mismatch: M.hasMismatch(r),
      canRelease: M.canRelease(r),
    });
  const held = M.transition(transfer, "hold", 101);
  assert.equal(summary(held).next, "briefVerify");
  assert.equal(summary(held).evidence[0], "pressure");
  assert.equal(summary(held).evidence.length, 2);
  const requested = M.transition(held, "request", 102);
  assert.equal(summary(requested).next, "briefAwait");
  const mismatch = M.transition(requested, "mismatch", 103, "wrongAmount");
  assert.equal(summary(mismatch).next, "briefMismatch");
  assert.equal(summary(mismatch).reason, "wrongAmount");
  assert.equal(summary(mismatch).gap, "briefMismatchLimit");
  const confirmed = M.transition(requested, "answer", 103, "knownNumber");
  const before = JSON.stringify(confirmed);
  assert.equal(summary(confirmed).next, "briefCheckReply");
  assert.equal(summary(confirmed).gap, "briefAttestedLimit");
  assert.equal(JSON.stringify(confirmed), before);
  const report = S.make(101, "Назовите код из SMS.", 200);
  const signals = S.inspect(report.text).map((s) => s.key);
  assert.deepEqual(W.caseBrief(report, { signals }), {
    event: "reportSent",
    status: "submitted",
    next: "briefMessage",
    reason: undefined,
    gap: "briefMessageLimit",
    evidence: ["askCodeSignal"],
  });
  assert.equal(
    W.caseBrief(S.resolve(report, "advised", "patternConcern", 201), {
      signals,
    }).next,
    "briefClosed",
  );
});

test("message brief prioritizes critical signals and states when no wording matched", () => {
  const report = S.make(
    102,
    "Срочно переведите деньги на безопасный счёт. Назовите код из SMS.",
    300,
  );
  const signals = S.inspect(report.text).map((match) => match.key);
  const original = [...signals];
  const brief = W.caseBrief(report, { signals });
  assert.deepEqual(brief.evidence, ["safeAccountSignal", "askCodeSignal"]);
  assert.deepEqual(signals, original);
  const plain = S.make(103, "Увидимся завтра после обеда.", 301);
  const noEvidence = W.caseBrief(plain, {
    signals: S.inspect(plain.text).map((match) => match.key),
  });
  assert.equal(noEvidence.next, "briefPlainMessage");
  assert.deepEqual(noEvidence.evidence, []);
  assert.equal(noEvidence.gap, "briefMessageLimit");
});

test("custom display names support Kazakh and Russian, persist by role, and validate stored IDs", () => {
  const customer = {
    role: "customer",
    id: "demo-" + "1".repeat(24),
    name: "  Айша   Ә. ",
  };
  const analyst = {
    role: "analyst",
    id: "demo-" + "2".repeat(24),
    name: "Анна Демо",
  };
  const accounts = W.accountsFrom([
    customer,
    analyst,
    { ...customer, id: '"><em>' },
  ]);
  assert.deepEqual(
    accounts.map((a) => a.name),
    ["Айша Ә.", "Анна Демо"],
  );
  assert.equal(W.displayName("<b>А</b>"), null);
  assert.equal(W.displayName(""), null);
  assert.equal(W.choices("customer", accounts).length, 2);
  assert.deepEqual(W.signIn("analyst", analyst.id, accounts), {
    id: analyst.id,
    role: "analyst",
  });
  assert.equal(W.signIn("customer", analyst.id, accounts), null);
  assert.equal(W.roleFor("network"), "analyst");
});

test("demo email is reserved for simulated accounts and lookup respects the selected role", () => {
  const stored = W.accountsFrom([
    {
      id: "demo-" + "9".repeat(24),
      role: "analyst",
      name: "Айша Демо",
      email: "TEST-USER@qalqan.example",
    },
  ]);
  assert.equal(W.demoEmail("outside@example.org"), null);
  assert.equal(W.demoEmail("ex@qalqan.example.invalid"), null);
  assert.equal(
    W.demoEmail("TEST-USER@qalqan.example"),
    "test-user@qalqan.example",
  );
  assert.equal(
    W.accountByLogin("analyst", "  айша   демо ", stored)?.email,
    "test-user@qalqan.example",
  );
  assert.equal(
    W.accountByLogin("analyst", "test-user@qalqan.example", stored)?.name,
    "Айша Демо",
  );
  assert.equal(
    W.accountByLogin("customer", "test-user@qalqan.example", stored),
    undefined,
  );
  assert.equal(
    W.accountByLogin("customer", "aliya@qalqan.example", stored)?.id,
    W.starter,
  );
});
