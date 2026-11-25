// Text-only demo. The matched excerpts are offsets into the original input.
const QMessage = (() => {
  const maxLength = 6000;
  const sources = [
    {
      key: "urgency",
      pattern:
        /срочно|немедленно|прямо сейчас|\d+\s*минут\w*|шұғыл|дереу|қазір|\d+\s*минут/iu,
    },
    {
      key: "safeAccountSignal",
      pattern:
        /безопасн[а-яё]+\s+сч[её]т[а-яё]*|қауіпсіз\s+шот[а-яәіңғүұқөһ]*/iu,
    },
    {
      key: "askCodeSignal",
      pattern:
        /передайте\s+(?:нам\s+)?код|(?:назовите|скажите|введите)\s+(?:нам\s+)?код|пришлите\s+(?:нам\s+)?код|сообщите\s+(?:нам\s+)?код|(?:sms|смс)[- ]код(?:ын|ты)?\s+(?:айтыңыз|жіберіңіз|енгізіңіз)|кодты\s+(?:айтыңыз|жіберіңіз)/iu,
    },
    {
      key: "linkSignal",
      pattern:
        /(?:https?:\/\/|www\.)[^\s<>"']+|[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*\.(?:kz|com|org|net|example)(?![a-z0-9])/iu,
    },
  ];
  sources.push(
    {
      key: "bankImpersonation",
      pattern:
        /служб[а-яё]+\s+безопасности\s+банка|сотрудник[а-яё]*\s+банка|банк[а-яәіңғүұқөһ]*\s+қауіпсіздік\s+қызмет[а-яәіңғүұқөһ]*|банк\s+қызметкер[а-яәіңғүұқөһ]*/iu,
    },
    {
      key: "secrecySignal",
      pattern:
        /никому не (?:рассказывайте|сообщайте) (?:об этом|про это)|держите в тайне|ешкімге (?:айтпаңыз|хабарламаңыз)/iu,
    },
    {
      key: "blockThreat",
      pattern:
        /сч[её]т\s+будет\s+заблокирован|карту\s+заблокируют|шот[а-яәіңғүұқөһ]*\s+бұғатталады/iu,
    },
    {
      key: "moneyRequest",
      pattern:
        /переведите\s+(?:нам\s+)?деньги|оплатите\s+сч[её]т|ақша(?:ны)?\s+(?:қауіпсіз\s+шотқа\s+)?аударыңыз|шотты\s+төлеңіз/iu,
    },
  );
  const sampleCorpus = [
    [
      "matchPressure",
      "Верните деньги на резервный банковский счет, иначе доступ к карте пропадет.",
    ],
    [
      "matchPressure",
      "Для защиты средств перенесите остаток на резервный счет сегодня.",
    ],
    [
      "matchPressure",
      "Қаражатты банк ұсынған резервтік шотқа жіберіп, картаңызды қорғаңыз.",
    ],
    [
      "matchCode",
      "Продиктуйте цифры из входящего сообщения для подтверждения личности.",
    ],
    [
      "matchCode",
      "Проверка личности закончится, когда вы продиктуете цифры из сообщения.",
    ],
    [
      "matchCode",
      "Жеке басыңызды растау үшін келген хабарламадағы сандарды оқып беріңіз.",
    ],
    [
      "matchRoutine",
      "Напоминаю, что встречаемся у библиотеки вечером. Дай знать, когда будешь рядом.",
    ],
    [
      "matchRoutine",
      "Кешке кітапхана жанында кездесеміз. Келгенде хабарласшы.",
    ],
  ];
  const categories = ["matchPressure", "matchCode", "matchRoutine"];
  function grams(input) {
    const text = input
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^\p{L}]+/gu, " ")
      .trim();
    return new Set(
      Array.from({ length: Math.max(0, text.length - 2) }, (_, i) =>
        text.slice(i, i + 3),
      ),
    );
  }
  function similarityHint(text) {
    const input = grams(text);
    if (input.size < 8) return null;
    let best = null;
    for (const [category, example] of sampleCorpus) {
      const other = grams(example);
      let overlap = 0;
      for (const gram of other) if (input.has(gram)) overlap++;
      const score = (2 * overlap) / (input.size + other.size);
      if (score >= 0.28 && (!best || score > best.score))
        best = { category, example, score };
    }
    return best ? { category: best.category, example: best.example } : null;
  }
  function level(keys) {
    if (
      keys.some((k) => ["safeAccountSignal", "askCodeSignal"].includes(k)) ||
      (keys.includes("bankImpersonation") && keys.includes("blockThreat"))
    )
      return "high";
    return keys.length ? "medium" : "low";
  }
  function summary(id, text, hint, time) {
    return {
      kind: "message-summary",
      id,
      time,
      signals: inspect(text).map((s) => s.key),
      category: hint?.category ?? null,
      status: "summarySaved",
      log: [{ time }],
    };
  }
  function validSummaries(rows) {
    return (
      Array.isArray(rows) &&
      rows.every(
        (r) =>
          r?.kind === "message-summary" &&
          r.status === "summarySaved" &&
          Number.isSafeInteger(r.id) &&
          r.id > 0 &&
          validTime(r.time) &&
          Array.isArray(r.signals) &&
          new Set(r.signals).size === r.signals.length &&
          r.signals.every((k) => sources.some((s) => s.key === k)) &&
          (r.category === null || categories.includes(r.category)) &&
          Array.isArray(r.log) &&
          r.log.length === 1 &&
          r.log[0]?.time === r.time &&
          Object.keys(r).every((k) =>
            [
              "kind",
              "id",
              "time",
              "signals",
              "category",
              "status",
              "log",
              "owner",
            ].includes(k),
          ) &&
          Object.keys(r.log[0]).length === 1 &&
          (r.owner === undefined || typeof r.owner === "string"),
      ) &&
      new Set(rows.map((r) => r.id)).size === rows.length
    );
  }
  const statuses = ["submitted", "advised", "inconclusive"];
  const decisions = {
    advised: ["patternConcern", "verifyWithBank"],
    inconclusive: ["contextMissing", "expectedMessage"],
  };
  const validText = (text) =>
    typeof text === "string" &&
    text.trim().length >= 12 &&
    text.trim().length <= maxLength;
  function inspect(text) {
    if (!validText(text)) throw Error("message length");
    return sources.flatMap(({ key, pattern }) => {
      const match = pattern.exec(text);
      return match
        ? [{ key, start: match.index, end: match.index + match[0].length }]
        : [];
    });
  }
  function make(id, text, time) {
    if (!validText(text)) throw Error("message length");
    return {
      kind: "message",
      id,
      text: text.trim(),
      time,
      status: "submitted",
      log: [{ event: "reportSent", time }],
    };
  }
  function resolve(report, status, reason, time) {
    if (
      report.status !== "submitted" ||
      !Object.hasOwn(decisions, status) ||
      !decisions[status].includes(reason)
    )
      throw Error("report decision");
    return {
      ...report,
      status,
      log: [...report.log, { event: status, time, reason }],
    };
  }
  const validTime = (n) => Number.isFinite(n) && Math.abs(n) < 8.64e15;
  function validReport(r) {
    if (
      !r ||
      r.kind !== "message" ||
      !Number.isSafeInteger(r.id) ||
      r.id <= 0 ||
      !validText(r.text) ||
      r.text !== r.text.trim() ||
      !validTime(r.time) ||
      !statuses.includes(r.status) ||
      !Array.isArray(r.log)
    )
      return false;
    const [entry, result] = r.log;
    if (!entry || entry.event !== "reportSent" || entry.time !== r.time)
      return false;
    if (r.status === "submitted") return r.log.length === 1;
    return (
      r.log.length === 2 &&
      result?.event === r.status &&
      validTime(result.time) &&
      decisions[r.status].includes(result.reason)
    );
  }
  const validReports = (reports) =>
    Array.isArray(reports) &&
    reports.every(validReport) &&
    new Set(reports.map((r) => r.id)).size === reports.length;
  return {
    maxLength,
    level,
    similarityHint,
    summary,
    validSummaries,
    statuses,
    decisions,
    validText,
    inspect,
    make,
    resolve,
    validReports,
  };
})();
if (typeof module !== "undefined") module.exports = QMessage;
