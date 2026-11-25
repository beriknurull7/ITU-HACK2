const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/model.js");
for (const [s, score, level] of [
  ["ordinary", 0, "low"],
  ["ambiguous", 30, "medium"],
  ["falsePositive", 60, "high"],
  ["suspicious", 130, "high"],
])
  test(s, () => {
    const a = M.assess(M.scenarios[s]);
    assert.equal(a.score, score);
    assert.equal(a.level, level);
  });
test("amount boundary, history and invalid inputs", () => {
  const d = M.scenarios.ordinary;
  assert.equal(M.assess({ ...d, amount: 53999 }).score, 0);
  assert.equal(M.assess({ ...d, amount: 54000 }).score, 30);
  assert.equal(M.assess({ ...d, activity: "rapid" }).score, 30);
  for (const amount of [0, -1, 0.1, 1000001, NaN, "12"])
    assert.equal(M.valid({ ...d, amount }), false);
  assert.equal(M.valid({ ...d, amount: 1000000 }), true);
  assert.equal(M.valid({ ...d, recipient: "toString" }), false);
});
test("high risk cannot complete directly and terminal states cannot be released again", () => {
  let r = M.make(1, M.scenarios.suspicious, 0);
  for (const e of ["pay", "checkedPay", "release"])
    assert.throws(() => M.transition(r, e, 1));
  for (const e of ["hold", "request", "answer", "keep", "release"])
    r = M.transition(
      r,
      e,
      1,
      e === "answer"
        ? "knownNumber"
        : e === "release"
          ? "verifiedDetails"
          : undefined,
    );
  assert.equal(r.status, "completed");
  assert.equal(r.log.length, 6);
  assert.throws(() => M.transition(r, "release", 2));
});
test("seed and storage validation", () => {
  const r = M.seeds();
  assert.ok(M.validRecords(r));
  assert.ok(!M.validRecords([r[0], r[0]]));
  assert.ok(!M.validRecords([{ ...r[0], status: "fiction" }]));
  assert.ok(!M.validRecords([{ ...r[0], log: [] }]));
});
test("a reported code request changes a familiar small transfer and requires a customer reply", () => {
  const d = { ...M.scenarios.ordinary, codeRequested: true };
  assert.deepEqual(M.assess(d), {
    signals: ["codeRequest"],
    score: 60,
    level: "high",
  });
  assert.equal(
    M.assess({ ...M.scenarios.suspicious, codeRequested: true }).score,
    190,
  );
  assert.equal(M.valid({ ...d, codeRequested: "on" }), false);
  let r = M.transition(M.make(10, d, 0), "hold", 1);
  for (const event of ["pay", "checkedPay", "release", "falseAlarm"])
    assert.throws(() => M.transition(r, event, 2));
  r = M.transition(M.transition(r, "request", 2), "answer", 3, "officialBank");
  assert.equal(
    M.transition(r, "release", 4, "verifiedDetails").status,
    "completed",
  );
});
test("recorded stops need an allowed reason and are final", () => {
  const held = M.transition(M.make(1, M.scenarios.suspicious, 0), "hold", 1);
  for (const reason of [undefined, "anything"])
    assert.throws(() => M.transition(held, "stop", 2, reason));
  for (const reason of M.stopReasons) {
    const r = M.transition(held, "stop", 2, reason);
    assert.deepEqual(r.log.at(-1), { event: "stop", time: 2, reason });
    assert.ok(M.validRecords([r]));
    assert.throws(() => M.transition(r, "release", 3));
    assert.throws(() => M.transition(r, "request", 3));
  }
  const req = M.transition(held, "request", 2);
  const disputed = M.transition(req, "dispute", 3);
  assert.equal(disputed.status, "stopped");
  assert.throws(() => M.transition(disputed, "answer", 4));
  assert.throws(() => M.transition(held, "dispute", 3));
});
test("older persisted transfers retain their assessment and remain reviewable", () => {
  const old = M.seeds();
  assert.ok(old.every((r) => r.codeRequested === undefined));
  assert.ok(M.validRecords(old));
  const caseRow = old.find((r) => r.status === "held");
  assert.equal(M.transition(caseRow, "request", 2).status, "requested");
});

test("verification remains required after a deferred or unanswered request", () => {
  const step = M.transition;
  const suspicious = step(M.make(11, M.scenarios.suspicious, 0), "hold", 1);
  assert.equal(M.canRelease(suspicious), false);
  const held = step(M.make(12, M.scenarios.falsePositive, 0), "hold", 1);
  assert.equal(M.canRelease(held), true);
  const requested = step(held, "request", 2);
  assert.throws(() => step(requested, "answer", 3));
  const deferred = step(requested, "deferVerification", 3);
  assert.equal(deferred.status, "held");
  assert.equal(M.verification(deferred).event, "deferVerification");
  for (const row of [deferred, step(step(deferred, "request", 4), "keep", 5)]) {
    assert.throws(() => step(row, "release", 6, "consistentPurpose"));
  }
  const confirmed = step(step(deferred, "request", 4), "answer", 5, "inPerson");
  assert.equal(M.verification(confirmed).channel, "inPerson");
  assert.equal(
    step(confirmed, "release", 6, "verifiedDetails").status,
    "completed",
  );
  assert.ok(M.validRecords([deferred]));
  assert.ok(M.validRecords([confirmed]));
});
test("edit records preserve valid before and after inputs and skip no-op changes", () => {
  const r = M.make(10, M.scenarios.suspicious, 0);
  const result = M.edit(r, M.scenarios.ordinary, 1);
  assert.equal(result.id, r.id);
  const { before, after } = result.log.at(-1);
  assert.equal(M.assess(before).score, 130);
  assert.equal(M.assess(after).score, 0);
  assert.equal(M.edit(result, after), result);
  assert.equal(M.assess(r).score, 130);
  assert.ok(M.validRecords([result]));
  assert.throws(() => M.edit(M.transition(r, "hold"), after));
  assert.equal(
    M.validRecords([
      { ...result, log: [{ event: "edited", time: 1, before: {}, after }] },
    ]),
    false,
  );
});

test("a reported mismatch preserves evidence and prevents release or reopening verification", () => {
  const held = M.transition(
    M.make(20, M.scenarios.falsePositive, 0),
    "hold",
    1,
  );
  const requested = M.transition(held, "request", 2);
  assert.throws(() =>
    M.transition(requested, "mismatch", 3, "unverifiedIntent"),
  );
  const mismatch = M.transition(requested, "mismatch", 3, "wrongBoth");
  assert.equal(mismatch.status, "held");
  assert.equal(M.verification(mismatch).reason, "wrongBoth");
  assert.ok(M.validRecords([mismatch]));
  for (const [action, reason] of [
    ["release", "consistentPurpose"],
    ["falseAlarm", "expectedPayment"],
    ["request", undefined],
  ]) {
    assert.throws(() => M.transition(mismatch, action, 4, reason));
  }
  const canceled = M.transition(mismatch, "cancel", 4);
  assert.equal(canceled.status, "canceled");
  assert.equal(M.verification(canceled).reason, "wrongBoth");
});
test("analyst release and false alarm require a supported reason, older audit entries still load", () => {
  const held = M.transition(
    M.make(21, M.scenarios.falsePositive, 0),
    "hold",
    1,
  );
  assert.throws(() => M.transition(held, "release", 2));
  assert.throws(() => M.transition(held, "release", 2, "verifiedDetails"));
  assert.throws(() => M.transition(held, "falseAlarm", 2, "wrongBoth"));
  for (const [event, reason] of [
    ["release", "consistentPurpose"],
    ["falseAlarm", "expectedPayment"],
  ]) {
    const finished = M.transition(held, event, 2, reason);
    assert.equal(finished.log.at(-1).reason, reason);
    assert.ok(M.validRecords([finished]));
    assert.ok(
      M.validRecords([{ ...finished, log: [...held.log, { event, time: 2 }] }]),
    );
  }
});

test("simulated screen-sharing gates transfer and edit snapshots preserve circumstances", () => {
  const d = { ...M.scenarios.ordinary, context: ["screenSharing"] };
  assert.equal(M.assess(d).score, 60);
  assert.equal(
    M.assess({
      ...M.scenarios.suspicious,
      codeRequested: true,
      context: [...M.circumstances, ...M.devices],
    }).score,
    M.maxScore,
  );
  assert.equal(
    M.valid({ ...d, context: ["screenSharing", "screenSharing"] }),
    false,
  );
  const r = M.make(44, d, 1);
  assert.throws(() => M.transition(r, "pay", 2));
  const held = M.transition(r, "hold", 2);
  assert.equal(M.canRelease(held), false);
  const revised = M.edit(r, { ...d, context: [] }, 2);
  assert.equal(M.assess(revised).score, 0);
  assert.deepEqual(revised.log.at(-1).before.context, ["screenSharing"]);
  assert.equal(M.edit(revised, { ...d, context: [] }, 3), revised);
});
