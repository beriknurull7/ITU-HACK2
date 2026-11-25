// All inputs are fictional. Assessments use a fixed activity snapshot so replay is deterministic.
const QModel = (() => {
  const recipients = {
    ali: { name: "Али Н.", known: true, initials: "АН", color: "sage" },
    mira: { name: "Мира С.", known: true, initials: "МС", color: "peach" },
    asel: { name: "Асель Т.", known: false, initials: "АТ", color: "lilac" },
    dana: { name: "Дана К.", known: false, initials: "ДК", color: "ice" },
  };
  const purposes = ["family", "goods", "rent", "safeAccount"];
  const activity = { normal: [-360, -150, -40], rapid: [-42, -7, -2] };
  const previousAmounts = [12000, 18000, 24000];
  const scenarios = {
    ordinary: {
      recipient: "ali",
      amount: 12000,
      purpose: "family",
      activity: "normal",
    },
    suspicious: {
      recipient: "dana",
      amount: 280000,
      purpose: "safeAccount",
      activity: "rapid",
    },
    ambiguous: {
      recipient: "asel",
      amount: 22000,
      purpose: "goods",
      activity: "normal",
    },
    falsePositive: {
      recipient: "mira",
      amount: 95000,
      purpose: "rent",
      activity: "rapid",
    },
  };
  const circumstances = [
    "remoteRequest",
    "urgentTransfer",
    "bankClaim",
    "secretTransfer",
    "rewardPressure",
  ];
  const devices = ["activeCall", "screenSharing"];
  const contextKeys = [...circumstances, ...devices];
  const validContext = (value) =>
    value === undefined ||
    (Array.isArray(value) &&
      new Set(value).size === value.length &&
      value.every((k) => contextKeys.includes(k)));
  const weights = {
    newRecipient: 30,
    large: 30,
    velocity: 30,
    pressure: 40,
    codeRequest: 60,
    remoteRequest: 20,
    urgentTransfer: 30,
    bankClaim: 30,
    secretTransfer: 40,
    rewardPressure: 30,
    activeCall: 30,
    screenSharing: 60,
  };
  const maxScore = Object.values(weights).reduce((a, b) => a + b, 0);
  const stopReasons = [
    "unverifiedIntent",
    "recipientMismatch",
    "reportedPressure",
  ];
  const mismatchReasons = ["wrongRecipient", "wrongAmount", "wrongBoth"];
  const releaseReasons = ["verifiedDetails", "consistentPurpose"];
  const falseAlarmReasons = ["expectedPayment", "explainedFrequency"];
  const channels = ["knownNumber", "inPerson", "officialBank"];
  const editFields = [
    "recipient",
    "amount",
    "purpose",
    "activity",
    "codeRequested",
    "context",
  ];
  const verificationEvents = [
    "request",
    "answer",
    "deferVerification",
    "mismatch",
  ];
  const statuses = [
    "pending",
    "completed",
    "canceled",
    "stopped",
    "held",
    "requested",
    "confirmed",
  ];
  function valid(d) {
    return (
      d &&
      Object.hasOwn(recipients, d.recipient) &&
      Number.isSafeInteger(d.amount) &&
      d.amount >= 1 &&
      d.amount <= 1000000 &&
      (d.codeRequested === undefined || typeof d.codeRequested === "boolean") &&
      validContext(d.context) &&
      purposes.includes(d.purpose) &&
      Object.hasOwn(activity, d.activity)
    );
  }
  function assess(d) {
    if (!valid(d)) throw Error("invalid");
    const signals = [];
    if (!recipients[d.recipient].known) signals.push("newRecipient");
    if (d.amount >= 3 * previousAmounts[1]) signals.push("large");
    if (activity[d.activity].filter((m) => m >= -10).length >= 2)
      signals.push("velocity");
    if (d.purpose === "safeAccount") signals.push("pressure");
    if (d.codeRequested) signals.push("codeRequest");
    signals.push(...contextKeys.filter((k) => d.context?.includes(k)));
    const score = signals.reduce((n, s) => n + weights[s], 0);
    return {
      signals,
      score,
      level: score >= 60 ? "high" : score >= 30 ? "medium" : "low",
    };
  }
  function make(id, details, time) {
    if (!valid(details)) throw Error("invalid");
    return {
      id,
      ...details,
      status: "pending",
      flagged: false,
      log: [{ event: "created", time }],
      time,
    };
  }
  function verification(r) {
    return r.log.findLast(({ event }) => verificationEvents.includes(event));
  }
  function needsVerification(r) {
    const latest = verification(r);
    return (
      r.codeRequested ||
      r.purpose === "safeAccount" ||
      r.context?.includes("screenSharing") ||
      !!latest
    );
  }
  function hasMismatch(r) {
    return verification(r)?.event === "mismatch";
  }
  function canRelease(r) {
    if (!["held", "confirmed"].includes(r.status)) return false;
    if (!needsVerification(r)) return true;
    return verification(r)?.event === "answer";
  }
  function transferDetails(d) {
    return {
      recipient: d.recipient,
      amount: d.amount,
      purpose: d.purpose,
      activity: d.activity,
      codeRequested: d.codeRequested ?? false,
      context: contextKeys.filter((k) => d.context?.includes(k)),
    };
  }
  function fieldChanged(key, before, after) {
    if (key === "context")
      return contextKeys.some(
        (k) =>
          Boolean(before.context?.includes(k)) !==
          Boolean(after.context?.includes(k)),
      );
    return before[key] !== after[key];
  }
  function edit(r, details, time = Date.now()) {
    if (r.status !== "pending" || !valid(details)) throw Error("edit");
    const before = transferDetails(r),
      after = transferDetails(details);
    if (!editFields.some((field) => fieldChanged(field, before, after)))
      return r;
    return {
      ...r,
      ...after,
      log: [...r.log, { event: "edited", time, before, after }],
    };
  }
  function reasonsFor(event, record) {
    switch (event) {
      case "request":
        return ["verifyDetailsRequest"];
      case "keep":
        return ["unfinishedReview", "reviewFurther"];
      case "mismatch":
        return mismatchReasons;
      case "stop":
        return stopReasons;
      case "release":
        return record && verification(record)?.event !== "answer"
          ? ["consistentPurpose"]
          : releaseReasons;
      case "falseAlarm":
        return falseAlarmReasons;
      default:
        return [];
    }
  }
  // Both interfaces use the same transition table. Only an analyst can release a held case.
  function transition(r, event, time = Date.now(), detail) {
    const level = assess(r).level;
    const transitions = {
      pending: {
        cancel: "canceled",
        hold: "held",
        ...(level === "low"
          ? { pay: "completed" }
          : level === "medium"
            ? { checkedPay: "completed" }
            : {}),
      },
      held: {
        stop: "stopped",
        request: "requested",
        release: "completed",
        falseAlarm: "completed",
        cancel: "canceled",
      },
      requested: {
        dispute: "stopped",
        mismatch: "held",
        stop: "stopped",
        answer: "confirmed",
        deferVerification: "held",
        keep: "held",
        cancel: "canceled",
      },
      confirmed: {
        stop: "stopped",
        keep: "held",
        release: "completed",
        falseAlarm: "completed",
        cancel: "canceled",
      },
    };
    const options = Object.hasOwn(transitions, r.status)
      ? transitions[r.status]
      : undefined;
    const next =
      options && Object.hasOwn(options, event) ? options[event] : undefined;
    const allowedReasons = reasonsFor(event, r);
    const reason =
      detail ??
      (["request", "keep"].includes(event) ? allowedReasons[0] : undefined);
    if (
      (["release", "falseAlarm"].includes(event) && !canRelease(r)) ||
      !next ||
      (event === "request" && hasMismatch(r)) ||
      (allowedReasons.length && !allowedReasons.includes(reason)) ||
      (["answer", "checkedPay"].includes(event) && !channels.includes(detail))
    )
      throw Error("transition");
    const entry = { event, time };
    if (allowedReasons.length) entry.reason = reason;
    if (["answer", "checkedPay"].includes(event)) entry.channel = detail;
    return {
      ...r,
      status: next,
      flagged: r.flagged || event === "hold",
      log: [...r.log, entry],
    };
  }
  function seeds(now = Date.now()) {
    return [
      ["ordinary", "pay"],
      ["suspicious", "hold"],
      ["falsePositive", "hold"],
      ["ambiguous", "cancel"],
    ].map(([s, e], i) => {
      const t = now - (i + 1) * 37 * 60000;
      return transition(make(1048 - i, scenarios[s], t), e, t + 30000);
    });
  }
  function validRecords(rows) {
    const events = [
      "created",
      "edited",
      "pay",
      "checkedPay",
      "cancel",
      "hold",
      "request",
      "answer",
      "keep",
      "release",
      "falseAlarm",
      "stop",
      "dispute",
      "deferVerification",
      "mismatch",
    ];
    return (
      Array.isArray(rows) &&
      new Set(rows.map((r) => r?.id)).size === rows.length &&
      rows.every(
        (r) =>
          valid(r) &&
          Number.isSafeInteger(r.id) &&
          r.id > 0 &&
          Number.isFinite(r.time) &&
          Math.abs(r.time) < 8.64e15 &&
          statuses.includes(r.status) &&
          typeof r.flagged === "boolean" &&
          (r.status !== "pending" || !r.flagged) &&
          (!["held", "requested", "confirmed", "stopped"].includes(r.status) ||
            r.flagged) &&
          Array.isArray(r.log) &&
          r.log.length > 0 &&
          r.log.every(
            (l) =>
              l &&
              events.includes(l.event) &&
              ((l.reason === undefined &&
                !["stop", "mismatch"].includes(l.event)) ||
                reasonsFor(l.event).includes(l.reason)) &&
              (l.channel === undefined ||
                (["answer", "checkedPay"].includes(l.event) &&
                  channels.includes(l.channel))) &&
              ((l.before === undefined && l.after === undefined) ||
                (l.event === "edited" && valid(l.before) && valid(l.after))) &&
              Number.isFinite(l.time) &&
              Math.abs(l.time) < 8.64e15,
          ),
      )
    );
  }
  return {
    canRelease,
    hasMismatch,
    reasonsFor,
    needsVerification,
    verification,
    channels,
    editFields,
    fieldChanged,
    circumstances,
    devices,
    edit,
    weights,
    maxScore,
    stopReasons,
    recipients,
    purposes,
    activity,
    previousAmounts,
    scenarios,
    statuses,
    valid,
    assess,
    make,
    transition,
    seeds,
    validRecords,
  };
})();
if (typeof module !== "undefined") module.exports = QModel;
