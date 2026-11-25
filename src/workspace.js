// Browser-only demo policies. A server must enforce access for a bank deployment.
const QWorkspace = (() => {
  const starter = "aliya";
  const employee = "arman";
  const names = {
    aliya: "Алия Н.",
    arman: "Арман С.",
    aigerim: "Айгерім М.",
    timur: "Тимур К.",
    zere: "Зере А.",
  };
  const registrationChoices = ["aigerim", "timur", "zere"];
  const roles = ["customer", "analyst"];
  const customerPages = [
    "overview",
    "transfer",
    "checkMessage",
    "history",
    "help",
    "detail",
    "message-detail",
    "message-summary",
  ];
  const analystPages = [
    "analyst",
    "case",
    "message-case",
    "network",
    "reports",
    "decisions",
    "rules",
  ];
  const themes = ["system", "light", "dark"];
  function roleFor(p) {
    if (customerPages.includes(p)) return "customer";
    if (analystPages.includes(p)) return "analyst";
    return null;
  }
  const ownerOf = (record) => record.owner ?? starter;
  function allowed(profile, page, record) {
    if (!profile || roleFor(page) !== profile.role) return false;
    if (!record) return true;
    if (profile.role === "customer") return ownerOf(record) === profile.id;
    return page === "case"
      ? record.flagged === true
      : page === "message-case" && record.kind === "message";
  }
  function displayName(value) {
    const name =
      typeof value === "string"
        ? value.normalize("NFC").trim().replace(/\s+/g, " ")
        : "";
    return name.length >= 2 &&
      name.length <= 40 &&
      /\p{L}/u.test(name) &&
      /^[\p{L}\p{M} .’'ʼ-]+$/u.test(name)
      ? name
      : null;
  }
  function demoEmail(value) {
    const address = String(value ?? "")
      .trim()
      .toLowerCase();
    return /^[a-z0-9]+(?:[._-][a-z0-9]+)*@qalqan\.example$/.test(address) &&
      address.length <= 64
      ? address
      : null;
  }
  const defaultEmail = (id) => id + "@qalqan.example";
  function accountByLogin(role, login, accounts) {
    const key = String(login ?? "")
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    return choices(role, accounts).find(
      (account) => account.name.toLowerCase() === key || account.email === key,
    );
  }
  function accountsFrom(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.flatMap((item) => {
      const record = registrationChoices.includes(item)
        ? { id: item, role: "customer", name: names[item] }
        : item;
      if (
        !record ||
        typeof record.id !== "string" ||
        seen.has(record.id) ||
        !roles.includes(record.role) ||
        !displayName(record.name)
      )
        return [];
      const presetRole = record.id === employee ? "analyst" : "customer";
      const preset = Object.hasOwn(names, record.id);
      if (
        preset
          ? record.role !== presetRole
          : !/^demo-[a-f0-9]{24}$/.test(record.id)
      )
        return [];
      seen.add(record.id);
      return [
        {
          id: record.id,
          role: record.role,
          name: displayName(record.name),
          email: demoEmail(record.email) ?? defaultEmail(record.id),
        },
      ];
    });
  }
  function choices(role, accounts) {
    const preset = role === "analyst" ? employee : starter;
    const stored = accounts.filter((account) => account.role === role);
    return stored.some((account) => account.id === preset)
      ? stored
      : [
          {
            id: preset,
            role,
            name: names[preset],
            email: defaultEmail(preset),
          },
          ...stored,
        ];
  }
  function signIn(role, id, accounts) {
    if (!roles.includes(role)) return null;
    return choices(role, accountsFrom(accounts)).some(
      (account) => account.id === id,
    )
      ? { role, id }
      : null;
  }
  function restore(raw, accounts) {
    // Upgrade the old role-only demo sessions to the corresponding preset.
    if (raw === "customer") return signIn(raw, starter, accounts);
    if (raw === "analyst") return signIn(raw, employee, accounts);
    try {
      const parsed = JSON.parse(raw);
      return parsed ? signIn(parsed.role, parsed.id, accounts) : null;
    } catch {
      return null;
    }
  }
  function themeMode(value) {
    return themes.includes(value) ? value : "light";
  }
  function effectiveTheme(mode, systemDark) {
    return themeMode(mode) === "system"
      ? systemDark
        ? "dark"
        : "light"
      : mode;
  }
  function caseBrief(record, assessment) {
    const message = record.kind === "message";
    const last = record.log.at(-1);
    const signalPriority = message
      ? {
          askCodeSignal: 3,
          safeAccountSignal: 3,
          bankImpersonation: 2,
          blockThreat: 2,
        }
      : (assessment.weights ?? {});
    const weight = (key) => signalPriority[key] ?? 0;
    const evidence = [...assessment.signals]
      .sort((a, b) => weight(b) - weight(a))
      .slice(0, 2);

    let next = "briefClosed";
    let gap = "briefTransferLimit";
    if (message) {
      gap = "briefMessageLimit";
      if (record.status === "submitted") {
        next = evidence.length ? "briefMessage" : "briefPlainMessage";
      }
    } else {
      if (record.status === "requested") next = "briefAwait";
      if (record.status === "confirmed") next = "briefCheckReply";
      if (record.status === "held") {
        next = assessment.mismatch
          ? "briefMismatch"
          : assessment.canRelease
            ? "briefReview"
            : "briefVerify";
      }
      if (assessment.mismatch) gap = "briefMismatchLimit";
      else if (assessment.attested) gap = "briefAttestedLimit";
    }
    return {
      status: record.status,
      evidence,
      gap,
      event: last.event,
      reason: last.reason,
      next,
    };
  }
  return {
    starter,
    employee,
    names,
    roles,
    themes,
    displayName,
    demoEmail,
    accountByLogin,
    accountsFrom,
    choices,
    roleFor,
    ownerOf,
    allowed,
    signIn,
    restore,
    themeMode,
    effectiveTheme,
    caseBrief,
  };
})();
if (typeof module !== "undefined") module.exports = QWorkspace;
