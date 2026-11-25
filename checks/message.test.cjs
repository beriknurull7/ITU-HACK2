const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/message.js");
const four = ["urgency", "safeAccountSignal", "askCodeSignal", "linkSignal"];
for (const text of [
  "Срочно переведите на безопасный счёт. Назовите код из SMS: https://pay-check.example",
  "Дереу қауіпсіз шотқа аударыңыз. SMS кодын айтыңыз: https://pay-check.example",
]) {
  test("extracts exact local-language fragments for four separate rules", () => {
    const hit = M.inspect(text);
    assert.deepEqual(
      hit.map((s) => s.key),
      four,
    );
    assert.equal(
      text.slice(hit[3].start, hit[3].end),
      "https://pay-check.example",
    );
  });
}
test("ordinary text, urgency alone, URL alone, and length boundaries", () => {
  assert.deepEqual(M.inspect("Встретимся в библиотеке."), []);
  assert.deepEqual(
    M.inspect("Кездесу бойынша жауап шұғыл керек.").map((h) => h.key),
    ["urgency"],
  );
  assert.deepEqual(
    M.inspect("Проверьте расписание https://status.example.").map((h) => h.key),
    ["linkSignal"],
  );
  for (const invalid of [
    "",
    " ".repeat(25),
    "x".repeat(11),
    "x".repeat(6001),
    42,
  ]) {
    assert.equal(M.validText(invalid), false);
    assert.throws(() => M.inspect(invalid));
  }
  assert.ok(M.validText("x".repeat(12)));
  assert.ok(M.validText("x".repeat(6000)));
});
test("submitted evidence survives either analyst decision and can only close once", () => {
  const r = M.make(101, "   Назовите код из SMS.   ", 1);
  assert.equal(r.text, "Назовите код из SMS.");
  assert.ok(M.validReports([r]));
  assert.ok(!M.validReports([r, r]));
  assert.throws(() => M.resolve(r, "advised", "contextMissing", 2));
  for (const [state, reason] of [
    ["advised", "patternConcern"],
    ["inconclusive", "contextMissing"],
  ]) {
    const next = M.resolve(r, state, reason, 2);
    assert.ok(M.validReports([next]));
    assert.deepEqual(next.log[1], { event: state, reason, time: 2 });
    assert.equal(next.text, r.text);
    assert.throws(() => M.resolve(next, state, reason, 3));
    assert.ok(!M.validReports([{ ...next, log: r.log }]));
  }
});

test("local similarity offers an example without changing rule severity", () => {
  const text = "Продиктуйте цифры из сообщения для подтверждения личности.";
  assert.equal(M.similarityHint(text).category, "matchCode");
  assert.equal(M.level(M.inspect(text).map((s) => s.key)), "low");
  assert.equal(M.similarityHint("Qz xw 12345678"), null);
});
test("saved summaries contain categories and no message or audio", () => {
  const text = "Дереу қауіпсіз шотқа аударыңыз. SMS кодын айтыңыз.";
  const saved = M.summary(101, text, null, 1);
  assert.ok(M.validSummaries([saved]));
  assert.ok(!JSON.stringify(saved).includes(text));
  assert.ok(!M.validSummaries([{ ...saved, text }]));
  assert.ok(!M.validSummaries([{ ...saved, audio: "blob:local" }]));
  assert.equal(M.level(saved.signals), "high");
});
