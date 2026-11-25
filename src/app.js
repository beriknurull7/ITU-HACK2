"use strict";
const M = QModel,
  S = QMessage,
  V = QVoice,
  W = QWorkspace,
  N = QNetwork,
  $ = (s) => document.querySelector(s);
const key = "qalqan.records.v1",
  summaryKey = "qalqan.summaries.v1",
  reportKey = "qalqan.reports.v1",
  languageKey = "qalqan.language.v1",
  profileKey = "qalqan.profile.v1",
  profilePlaceKey = "qalqan.profile.place.v1",
  accountsKey = "qalqan.accounts.v1",
  themeKey = "qalqan.appearance.v1";
let profile = null,
  accountId = null,
  accounts = [],
  theme = "light";
let entryRole = null,
  registering = false,
  nameDraft = "",
  loginDraft = "",
  emailDraft = "",
  entryError = "";
let resume = null,
  returnPlace = null;
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const actor = () => (profile ? { role: profile, id: accountId } : null);
const home = () => (profile === "analyst" ? "analyst" : "overview");
const profileName = (id) =>
  accounts.find((account) => account.id === id)?.name ?? W.names[id];
function saveAccount(account) {
  const original = W.choices(account.role, accounts).find(
    (item) => item.id === account.id,
  );
  account = { ...original, ...account };
  accounts = [...accounts.filter((item) => item.id !== account.id), account];
  try {
    localStorage.setItem(accountsKey, JSON.stringify(accounts));
  } catch {
    warning = "storeFail";
  }
}
function nameError(value, role, id) {
  if (!value) return "invalidDisplayName";
  return W.choices(role, accounts).some(
    (account) =>
      account.id !== id && account.name.toLowerCase() === value.toLowerCase(),
  )
    ? "nameUsed"
    : "";
}
const myRecord = (r) => W.ownerOf(r) === accountId;
function applyTheme() {
  const effective = W.effectiveTheme(theme, systemTheme.matches);
  document.documentElement.dataset.theme = effective;
  $('meta[name="theme-color"]').content =
    effective === "dark" ? "#141419" : "#ffffff";
  networkCanvas?.paint();
  caseCanvas?.paint();
}
systemTheme.addEventListener("change", applyTheme);
const listState = {
  history: { filter: "", search: "" },
  analyst: { filter: "open", search: "" },
  reports: { filter: "open", search: "" },
};
let historyKind = "all",
  decisionScope = "",
  decisionSearch = "";
let caseOrigin = "analyst";
let ruleExample = "ambiguous",
  sandboxLow = 30,
  sandboxHigh = 60;
const staffQueue = () => ["analyst", "reports"].includes(page);
const queueFilters = { risk: "", days: "", sort: "priority" };
const networkSelection = { node: "", edge: null };
const networkFilters = { risk: "", days: "", status: "" };
const compactNetwork = window.matchMedia("(max-width:700px)");
let networkMode = compactNetwork.matches ? "list" : "space";
let graphicsUnavailable = false;
let networkCanvas = null,
  caseCanvas = null;
let timelineOpen = false;
let summaries = [],
  reportSummaryId = null,
  mode = "text",
  useSimilarity = true,
  messageHint = null;
let reports = [],
  messageDraft = "",
  checkedMessage = null;
let lang = "ru",
  warning = "",
  rows,
  page = "access",
  activeId = null,
  draft = {},
  draftScenario = "",
  filter = "",
  search = "",
  menu = false,
  editing = null;
try {
  theme = W.themeMode(localStorage.getItem(themeKey));
  const saved = JSON.parse(localStorage.getItem(accountsKey));
  accounts = W.accountsFrom(saved);
} catch {
  // Use the default theme and starter account if preferences are unavailable.
}
applyTheme();
try {
  const legacy = sessionStorage.getItem(profileKey);
  let current = legacy;
  try {
    current = localStorage.getItem(profileKey) ?? legacy;
    if (legacy && current === legacy) localStorage.setItem(profileKey, legacy);
    sessionStorage.removeItem(profileKey);
  } catch {
    // The current tab can still restore a session.
  }
  const saved = W.restore(current, accounts);
  if (saved) {
    profile = saved.role;
    accountId = saved.id;
    page = home();
    filter = listState[page]?.filter ?? "";
  }
} catch {
  // Start at the entry screen when session storage is unavailable.
}
function saveProfile(selected) {
  profile = selected?.role ?? null;
  accountId = selected?.id ?? null;
  try {
    if (selected) localStorage.setItem(profileKey, JSON.stringify(selected));
    else localStorage.removeItem(profileKey);
  } catch {
    try {
      if (selected)
        sessionStorage.setItem(profileKey, JSON.stringify(selected));
      else sessionStorage.removeItem(profileKey);
    } catch {
      warning = "storeFail";
    }
  }
  try {
    sessionStorage.removeItem(profilePlaceKey);
  } catch {
    // The profile still works in memory when storage is unavailable.
  }
}
try {
  lang = localStorage.getItem(languageKey) === "kk" ? "kk" : "ru";
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    try {
      rows = JSON.parse(saved);
      if (!M.validRecords(rows)) throw Error();
    } catch {
      warning = "restored";
      rows = null;
    }
  }
} catch {
  warning = "storeFail";
}
if (!rows) {
  rows = M.seeds();
  persist();
}
try {
  const saved = localStorage.getItem(reportKey);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (S.validReports(parsed)) reports = parsed;
    else warning ||= "reportsRestored";
  }
} catch {
  warning ||= "reportsRestored";
}
try {
  const saved = localStorage.getItem(summaryKey);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (S.validSummaries(parsed)) summaries = parsed;
    else warning ||= "summariesRestored";
  }
} catch {
  warning ||= "summariesRestored";
}
function persistSummaries() {
  try {
    localStorage.setItem(summaryKey, JSON.stringify(summaries));
  } catch {
    warning = "storeFail";
  }
}
function persistReports() {
  try {
    localStorage.setItem(reportKey, JSON.stringify(reports));
  } catch {
    warning = "storeFail";
  }
}
const items = () =>
  [...rows, ...reports, ...summaries]
    .filter((r) =>
      profile === "analyst"
        ? isReport(r) || r.flagged
        : profile === "customer" && myRecord(r),
    )
    .sort((a, b) => b.log.at(-1).time - a.log.at(-1).time);
const isReport = (r) => r.kind === "message";
const isSummary = (r) => r.kind === "message-summary";
const isMessage = (r) => isReport(r) || isSummary(r);
const itemId = (r) => (isSummary(r) ? "#S-" : isReport(r) ? "#M-" : "#") + r.id;
const itemName = (r) =>
  isSummary(r)
    ? t("summarySaved")
    : isReport(r)
      ? t("messageReport")
      : M.recipients[r.recipient].name;
const t = (k) => copy[k][lang === "ru" ? 0 : 1];
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const names = {
  overview: "grid",
  transfer: "send",
  checkMessage: "message",
  history: "history",
  analyst: "scan",
  network: "network",
  reports: "message",
  decisions: "history",
  rules: "wheel",
  help: "info",
  ordinary: "user",
  suspicious: "alert",
  ambiguous: "split",
  falsePositive: "flag",
  reset: "reset",
};
const paths = {
  network:
    '<path d="m6 7 12 5L6 17"/><circle cx="5" cy="6" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="12" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19"/>',
  moon: '<path d="M21 14A9 9 0 0 1 10 3a9 9 0 1 0 11 11Z"/>',
  monitor:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11v2a7 7 0 0 0 14 0v-2m-7 9v3m-3 0h6"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',

  message: '<path d="M21 4H3v12h4v4l5-4h9zM7 8h10M7 12h6"/>',

  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  send: '<path d="m21 3-7 18-4-7-7-4zM10 14l6-6"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7m2-4v5l3 2"/>',
  scan: '<path d="M3 8V4h5m8 0h5v4M3 16v4h5m8 0h5v-4M3 12h18"/><circle cx="12" cy="12" r="3"/>',
  user: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  alert: '<path d="m12 3 9 16a1 1 0 0 1-1 2H4a1 1 0 0 1-1-2zM12 9v5m0 3v.2"/>',
  split:
    '<path d="M6 3v3c0 7 12 4 12 12v3m-4-4 4 4 4-4M18 3v3c0 2-1 4-3 5M8 14c-2 2-2 4-2 7m-4-4 4 4 4-4"/>',
  flag: '<path d="M5 21V4q4-3 8 0t7 0v10q-4 3-8 0t-7 0"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
  shield:
    '<path d="m12 2 8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="m8.5 12 2.5 2.5 5-5"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  pulse: '<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  swap: '<path d="M3 8h16m-4-4 4 4-4 4M21 16H5m4-4-4 4 4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet: '<path d="M3 7V5l14-3v5M3 7h18v13H3zM21 12h-6v4h6"/>',
  wheel:
    '<circle cx="12" cy="12" r="8"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 7h8M8 11h6"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
};
function icon(n, size = 19) {
  return (
    '<svg aria-hidden="true" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    paths[n] +
    "</svg>"
  );
}
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    warning = "storeFail";
  }
}
function announce(k) {
  $("#live").textContent = t(k);
}
const groupTenge = new Intl.NumberFormat("fr-FR");
function money(n) {
  return groupTenge.format(n) + " ₸";
}
// Some Chromium builds fall back to "M11" for Kazakh month names.
const almatyClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Almaty",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const months = {
  ru: "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split(
    " ",
  ),
  kk: "қаңтар ақпан наурыз сәуір мамыр маусым шілде тамыз қыркүйек қазан қараша желтоқсан".split(
    " ",
  ),
};
function date(n, long = false) {
  const d = Object.fromEntries(
    almatyClock.formatToParts(n).map(({ type, value }) => [type, value]),
  );
  const day = Number(d.day) + " " + months[lang][Number(d.month) - 1];
  return long
    ? day + " " + d.year + (lang === "kk" ? " ж." : " г.")
    : day + ", " + d.hour + ":" + d.minute;
}
const active = (r) =>
  ["held", "requested", "confirmed", "submitted"].includes(r.status);
const current = () => recordFor(page, activeId);
const button = (action, label, style = "secondary", ic = "") =>
  '<button type="button" class="btn ' +
  style +
  '" data-a="' +
  action +
  '">' +
  (ic ? icon(ic) : "") +
  t(label) +
  "</button>";
const opt = (k, v, label) =>
  '<option value="' +
  esc(k) +
  '" ' +
  (k === v ? "selected" : "") +
  ">" +
  esc(label) +
  "</option>";
const pair = (k, v) =>
  '<div class="pair"><dt>' + t(k) + "</dt><dd>" + esc(v) + "</dd></div>";
function badge(status, label = status) {
  return '<span class="badge ' + status + '"><i></i>' + t(label) + "</span>";
}
function transferBadge(r) {
  return badge(
    r.status,
    r.status === "held" && M.hasMismatch(r) ? "mismatchBtn" : r.status,
  );
}
function avatar(r) {
  const p = M.recipients[r.recipient];
  return (
    '<span aria-hidden="true" class="avatar ' +
    p.color +
    '">' +
    p.initials +
    "</span>"
  );
}
const savedCaseViews = {
  detail: () => rows,
  case: () => rows.filter((r) => r.flagged),
  "message-detail": () => reports,
  "message-case": () => reports,
  "message-summary": () => summaries,
};
function recordFor(p, id) {
  return Object.hasOwn(savedCaseViews, p)
    ? savedCaseViews[p]().find((r) => r.id === id)
    : undefined;
}
function allowed(p, id) {
  const record = recordFor(p, id);
  return (
    (!Object.hasOwn(savedCaseViews, p) || !!record) &&
    W.allowed(actor(), p, record)
  );
}
function rememberProfilePlace(p, id) {
  try {
    if (allowed(p, id))
      sessionStorage.setItem(
        profilePlaceKey,
        JSON.stringify({ page: p, id, origin: caseOrigin }),
      );
    else sessionStorage.removeItem(profilePlaceKey);
  } catch {
    // Navigation works when session storage is blocked.
  }
}
function restoreProfilePlace() {
  if (!profile) return;
  try {
    const saved = JSON.parse(sessionStorage.getItem(profilePlaceKey));
    if (
      !saved ||
      !allowed(saved.page, saved.id) ||
      (![
        "overview",
        "history",
        "help",
        "analyst",
        "network",
        "reports",
        "decisions",
        "rules",
      ].includes(saved.page) &&
        !recordFor(saved.page, saved.id))
    )
      return;
    page = saved.page;
    if (["analyst", "reports", "network", "decisions"].includes(saved.origin))
      caseOrigin = saved.origin;
    activeId = saved.id;
    filter = listState[page]?.filter ?? "";
  } catch {
    // An invalid resume pointer falls back to the role home.
  }
}
function focusPage() {
  render();
  window.scrollTo(0, 0);
  $("#main").focus({ preventScroll: true });
}
function showEntry(role, pending = null) {
  if (page !== "access") {
    syncDraft();
    returnPlace = { page, id: activeId };
  }
  V.clear();
  page = "access";
  menu = false;
  entryRole = role;
  registering = false;
  entryError = "";
  nameDraft = emailDraft = "";
  resume = pending;
  const record = pending && recordFor(pending.page, pending.id);
  const preferred =
    role === profile ? accountId : role === "customer" ? W.starter : W.employee;
  const suggested =
    role === "customer" && record ? W.ownerOf(record) : preferred;
  loginDraft = role
    ? (W.choices(role, accounts).find((item) => item.id === suggested)?.email ??
      "")
    : "";
  focusPage();
}
function openPage(p, id = null, { prepare, after } = {}) {
  const role = W.roleFor(p);
  if (!role || role !== profile) {
    if (
      profile &&
      Object.hasOwn(savedCaseViews, p) &&
      id === activeId &&
      recordFor(page, activeId) === recordFor(p, id) &&
      allowed(page, activeId)
    )
      showEntry(role, { page: p, id, prepare, after });
    return;
  }
  if (!allowed(p, id)) {
    warning = "restrictedRecord";
    p = home();
    id = null;
    prepare = after = undefined;
  } else if (warning === "restrictedRecord") {
    warning = "";
  }
  if (page === "checkMessage" && p !== "checkMessage") V.clear();
  if (p !== page || id !== activeId) timelineOpen = false;
  prepare?.();
  menu = false;
  page = p;
  activeId = id;
  filter = listState[p]?.filter ?? "";
  search = listState[p]?.search ?? "";
  rememberProfilePlace(p, id);
  focusPage();
  after?.();
}
function openTransfer(details, scenario = "", editId = null) {
  openPage("transfer", null, {
    prepare: () => {
      draft = { ...details };
      draftScenario = scenario;
      editing = editId;
    },
  });
}
function start(s = "", r = null) {
  openTransfer(
    r ??
      (s
        ? M.scenarios[s]
        : { recipient: "", amount: "", purpose: "", activity: "normal" }),
    s,
    r?.id,
  );
}
function navBtn(k) {
  const selected = section() === k;
  return (
    '<button data-a="nav:' +
    k +
    '" class="nav-item ' +
    (selected ? "selected" : "") +
    '" ' +
    (selected ? 'aria-current="page"' : "") +
    ">" +
    icon(names[k]) +
    t(k === "history" ? "activityTitle" : k) +
    (k === "analyst"
      ? "<small>" + items().filter(active).length + "</small>"
      : "") +
    "</button>"
  );
}
function section() {
  if (["detail", "message-detail", "message-summary"].includes(page))
    return "history";
  if (["case", "message-case"].includes(page)) return caseOrigin;
  return page;
}
function navigation(customer) {
  if (customer)
    return ["overview", "transfer", "checkMessage", "history", "help"]
      .map(navBtn)
      .join("");
  return `${["analyst", "reports", "network", "decisions", "rules"].map(navBtn).join("")}`;
}
function pageBody() {
  if (page === "overview") return overview();
  if (page === "transfer") return form();
  if (page === "history" || staffQueue()) return listPage();
  if (page === "network") return networkPage();
  if (page === "help") return helpPage();
  if (page === "rules") return rulesPage();
  if (page === "decisions") return decisionsPage();
  if (page === "checkMessage") return messagePage();
  if (page === "message-summary") return summaryDetail();
  if (["message-case", "message-detail"].includes(page)) return messageDetail();
  return detail();
}
function appearanceControls() {
  return `<div class="langs" role="group" aria-label="${t("lang")}">${[
    "kk",
    "ru",
  ]
    .map(
      (l) =>
        `<button data-a="lang:${l}" lang="${l}" aria-label="${l === "kk" ? "Қазақша" : "Русский"}" aria-pressed="${l === lang}">${l === "kk" ? "ҚАЗ" : "РУС"}</button>`,
    )
    .join("")}</div>
  <div class="top-menu">
    <button id="themeButton" type="button" class="icon-button" data-a="top-menu:theme" aria-label="${t("themeLabel")}" aria-expanded="false" aria-controls="themeMenu" title="${t("themeLabel")}">${themeIcon()}</button>
    <div id="themeMenu" class="menu-popover" hidden>
      <div class="menu-heading">${t("themeLabel")}</div>
      ${W.themes.map((mode) => `<button type="button" data-a="theme:${mode}" aria-pressed="${mode === theme}">${icon({ system: "monitor", light: "sun", dark: "moon" }[mode], 17)}<span>${t("theme" + mode[0].toUpperCase() + mode.slice(1))}</span>${mode === theme ? icon("check", 16) : ""}</button>`).join("")}
    </div>
  </div>`;
}
function themeIcon() {
  return icon({ system: "monitor", light: "sun", dark: "moon" }[theme], 20);
}
function profileControl(customer) {
  const name = profileName(accountId);
  const initial = name?.match(/\p{L}/u)?.[0]?.toUpperCase();
  return `<div class="top-menu">
    <button type="button" id="profileButton" class="icon-button profile-avatar" data-a="sign-in" aria-label="${esc(t("profileMenu") + " · " + name)}" aria-expanded="false" aria-controls="profileMenu" title="${t("profileMenu")}">${initial ? esc(initial) : icon("user")}</button>
    <div id="profileMenu" class="menu-popover profile-popover" hidden>
      <div class="menu-heading"><strong>${esc(name)}</strong><small>${t(customer ? "customerRole" : "employeeRole")}</small></div>
      ${button("profile-settings", "profileSettings", "menu-action", "wheel")}
      ${button("other-role", "switchProfile", "menu-action", "swap")}
      ${button("sign-out", "signOut", "menu-action")}
    </div></div>`;
}
function topMenu(name, show, focus = false) {
  const toggle = $("#" + name + "Button");
  const panel = $("#" + name + "Menu");
  if (!toggle || !panel) return;
  panel.hidden = !show;
  toggle.setAttribute("aria-expanded", String(show));
  if (show) closeTopMenus(false, name);
  if (focus) toggle.focus();
}
function closeTopMenus(focus = false, except = "") {
  for (const name of ["theme", "profile"]) {
    if (name !== except && $("#" + name + "Menu")?.hidden === false)
      topMenu(name, false, focus);
  }
}
function entry() {
  const choices = entryRole ? W.choices(entryRole, accounts) : [];
  const title = !entryRole
    ? "accessTitle"
    : registering
      ? "registerTitle"
      : entryRole === "customer"
        ? "customerEntry"
        : "analystEntry";
  const brand =
    '<div class="brand"><img src="assets/mark.svg" width="39" height="39" alt=""><strong>Qalqan</strong></div>';
  const back =
    entryRole || returnPlace
      ? button(
          "entry-back",
          resume ? "returnToRecord" : entryRole ? "chooseWorkspace" : "close",
          "text-btn entry-back",
          "back",
        )
      : "";
  const heading = `<div class="access-heading"><div class="access-demo">${icon("shield", 17)}${t("demo")}</div>
    <h1>${t(title)}</h1><p>${t(!entryRole ? "accessIntro" : registering ? "createLocalCredentials" : "demoCredentials")}</p></div>`;
  return `<div class="entry-shell"><header class="entry-top">${brand}<div class="utilities">${appearanceControls()}</div></header>
    <main id="main" class="entry-main access-layout" tabindex="-1">
      <div class="entry-intro">${heading}
        ${
          entryRole
            ? `<div class="access-guide">
          <h2>${t("demoAccessTitle")}</h2><p>${t("demoAccessHelp")}</p>
        </div>`
            : ""
        }
      </div>
      <section class="panel entry-panel access-panel">${
        entryRole
          ? `
      <form id="accessForm" novalidate>
        ${resume ? `<p class="entry-record">${t("openRequestedRecord")} · ${itemId(recordFor(resume.page, resume.id))}</p>` : ""}
        ${registering ? `<h2>${t("demoRegistration")}</h2>` : ""}
        ${
          registering
            ? `<label for="displayName">${t("displayName")}</label>
          <input id="displayName" maxlength="40" autocomplete="off" spellcheck="false" value="${esc(nameDraft)}" aria-describedby="accessError" required>
          <label for="demoEmail">${t("demoEmailLabel")}</label>
          <input id="demoEmail" type="email" maxlength="64" autocomplete="off" spellcheck="false" placeholder="aisha@qalqan.example" value="${esc(emailDraft)}" aria-describedby="demoEmailHint accessError" required>
          <small id="demoEmailHint">${t("demoEmailHint")}</small>`
            : `<label for="accountLogin">${t("usernameOrEmail")}</label>
          <input id="accountLogin" maxlength="64" list="savedLogins" autocomplete="off" spellcheck="false" autocapitalize="off" value="${esc(loginDraft)}" aria-describedby="accessError" required>
          <datalist id="savedLogins">${choices.map(({ name, email }) => opt(email, null, name)).join("")}</datalist>`
        }
        <p id="accessError" class="entry-error" role="alert">${entryError ? t(entryError) : ""}</p>
        <button type="submit" class="btn primary access-submit">${t(registering ? "register" : "signInDemo")}${icon("arrow", 16)}</button>
        ${!resume ? button("entry-register", registering ? "existingAccount" : "register", "text-btn access-switch") : ""}
      </form>`
          : `<h2>${t("chooseWorkspace")}</h2><div class="entry-roles">
        ${W.roles.map((role) => `<button class="entry-role" data-a="entry:${role}"><span class="entry-role-icon">${icon(role === "customer" ? "user" : "scan", 22)}</span><span><strong>${t(role === "customer" ? "customerRole" : "employeeRole")}</strong><small>${t(role + "ProfileTask")}</small></span>${icon("right", 18)}</button>`).join("")}
      </div>`
      }${back}</section>
    </main></div>`;
}
function render() {
  caseCanvas?.dispose();
  caseCanvas = null;
  networkCanvas?.dispose();
  networkCanvas = null;
  document.documentElement.lang = lang;
  document.title =
    "Qalqan · " +
    t(
      page === "access"
        ? "signIn"
        : section() === "history"
          ? "activityTitle"
          : section(),
    );
  $(".skip").textContent = t("skip");
  if (page === "access") {
    $("#app").innerHTML = entry();
    return;
  }
  const customer = profile === "customer";
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar ${menu ? "shown" : ""}" id="side" ${menu ? `role="dialog" aria-modal="true" aria-label="${t("nav")}"` : ""}>
    <div class="brand"><img src="assets/mark.svg" width="39" height="39" alt=""><strong>Qalqan</strong></div>
    ${menu ? `<button class="drawer-close" aria-label="${t("closeMenu")}" data-a="menu">${icon("close", 16)}</button>` : ""}
    <nav aria-label="${t("nav")}">
    ${navigation(customer)}
    </nav>${customer ? `<div class="side-bottom"><button data-a="reset" class="reset">${icon("reset", 16)}${t("reset")}</button></div>` : ""}</aside>` +
    (menu
      ? '<button class="veil" aria-label="' +
        t("close") +
        '" data-a="menu"></button>'
      : "") +
    '<div class="workspace" ' +
    (menu ? "inert" : "") +
    '><header class="topbar"><div class="crumb"><button class="menu-icon" aria-label="' +
    t("openMenu") +
    '" aria-expanded="' +
    menu +
    '" aria-controls="side" data-a="menu">' +
    icon(menu ? "close" : "menu") +
    "</button>" +
    "<strong>" +
    t(section() === "history" ? "activityTitle" : section()) +
    '</strong></div><div class="utilities">' +
    `<span class="demo-pill desktop-demo"><i></i>${t("demo")}</span>` +
    appearanceControls() +
    profileControl(customer) +
    '</div></header><main id="main" tabindex="-1">' +
    (warning ? '<p class="notice" role="status">' + t(warning) + "</p>" : "") +
    pageBody() +
    "</main><footer>" +
    icon("lock", 13) +
    t("demoNote") +
    "</footer></div></div>";
  if (page === "network") mountNetwork();
  if ($("#caseCanvas")) mountTimeline(current());
}
function heading(title, sub) {
  return `<div class="page-heading"><div><h1>${t(title)}</h1>${sub ? `<p>${t(sub)}</p>` : ""}</div></div>`;
}
function scenList() {
  return (
    '<section class="panel scenario-panel" id="scenarios" tabindex="-1"><div class="card-heading"><h2>' +
    t("scenarios") +
    "</h2>" +
    icon("layers") +
    '</div><div class="scenario-list">' +
    Object.keys(M.scenarios)
      .map(
        (s, i) =>
          '<button class="scenario" data-a="scenario:' +
          s +
          '"><span class="tile t' +
          i +
          '">' +
          icon(names[s]) +
          "</span><span><strong>" +
          t(s) +
          "</strong><small>" +
          t(s + "Desc") +
          "</small></span>" +
          icon("right", 15) +
          "</button>",
      )
      .join("") +
    "</div></section>"
  );
}
function priority(a, b) {
  const rank = (r) =>
    ({ confirmed: 0, submitted: 1, held: 2, requested: 3 })[r.status] ?? 4;
  const rankDifference = rank(a) - rank(b);
  if (rankDifference) return rankDifference;
  if (rank(a) === 4) return b.log.at(-1).time - a.log.at(-1).time;
  if (isReport(a)) return a.time - b.time;
  return M.assess(b).score - M.assess(a).score || a.time - b.time;
}
function caseTicket() {
  const rows = items().filter((r) => !isMessage(r));
  const customerCase = rows.find(
    (x) =>
      x.status === "requested" || (x.status === "held" && M.hasMismatch(x)),
  );
  const latestReport = items()
    .filter(isReport)
    .sort((a, b) => b.log.at(-1).time - a.log.at(-1).time)[0];
  if (!customerCase && latestReport) {
    return `<article class="case-ticket">
      <div class="ticket-head"><span>${icon("message", 15)}${t("messageReportTitle")}</span><code>${itemId(latestReport)}</code></div>
      <div class="ticket-main"><strong>${t(latestReport.status)}</strong></div>
      <button data-a="message-detail:${latestReport.id}" class="ticket-link">${t("opened")}${icon("arrow", 17)}</button>
    </article>`;
  }
  const r =
    customerCase ||
    rows.find((x) => x.status === "pending") ||
    rows.filter(active).sort(priority)[0];
  const sample = M.scenarios.ordinary;
  const mismatch = r?.status === "held" && M.hasMismatch(r);
  const prompt = !r
    ? "ordinary"
    : r.status === "requested"
      ? "needsReply"
      : mismatch
        ? "mismatchTicket"
        : r.status === "pending"
          ? "needsDecision"
          : "needsReview";
  const action = !r ? "scenario:ordinary" : "detail:" + r.id;
  return `<article class="case-ticket">
    <div class="ticket-head"><span>${icon("receipt", 15)}${t("caseCard")}</span><code>${r ? "#" + r.id : t("scenario")}</code></div>
    <div class="ticket-main"><div class="ticket-name">${avatar(r || sample)}<strong>${M.recipients[(r || sample).recipient].name}</strong></div>
    <strong class="ticket-amount">${money((r || sample).amount)}</strong>
    <p>${t(prompt)}</p></div>
    <button data-a="${action}" class="ticket-link">${t(!r ? "tryScenario" : r.status === "requested" ? "openReply" : "opened")}${icon("arrow", 17)}</button>
  </article>`;
}
function overview() {
  return `<section class="safety-hub">
    <div class="hub-main"><h1>${t("hubTitle")}</h1>
    <div class="hub-tasks">
      <button data-a="nav:checkMessage" class="hub-task message-task">${icon("message", 24)}<span><strong>${t("checkMessage")}</strong><small>${t("messageTask")}</small></span>${icon("right", 17)}</button>
      <button data-a="nav:transfer" class="hub-task">${icon("send", 24)}<span><strong>${t("transfer")}</strong><small>${t("transferTask")}</small></span>${icon("right", 17)}</button>
    </div>${button("demo-message", "demoMessage", "text-btn", "scan")}</div>
    <div class="hub-case">${caseTicket()}</div></section>
    <div class="desk-grid overview-grid">${scenList()}<section class="panel latest">
      <div class="card-heading"><h2>${t("latestActivity")}</h2>${button("nav:history", "allActivity", "text-btn", "history")}</div>
      ${table(items().slice(0, 4), "detail", true)}
    </section></div>`;
}
function table(data, target, compact = false) {
  const analyst = target === "case";
  if (!data.length)
    return `<div class="empty">${icon("search", 28)}
    <h3>${t(analyst ? "queueEmpty" : "reportEmpty")}</h3><p>${t(analyst ? "queueEmptyHint" : "reportEmptyHelp")}</p></div>`;
  return `<div class="table-wrap"><table class="${compact ? "compact" : "full"}">
    <thead><tr><th scope="col">${t("activityItem")}</th><th class="amount" scope="col">${t("amount")}</th>
    ${compact ? "" : `<th class="activity-risk" scope="col">${t("messageRiskColumn")}</th>`}<th scope="col">${t("status")}</th>
    ${analyst ? `<th class="queue-signals" scope="col">${t("signals")}</th>` : ""}</tr></thead>
    <tbody>${data.map((r) => activityRow(r, target, compact)).join("")}</tbody></table></div>`;
}
function activityRow(r, target, compact) {
  const analyst = target === "case",
    message = isMessage(r);
  const action =
    (isSummary(r) ? "message-summary" : (message ? "message-" : "") + target) +
    ":" +
    r.id;
  const assessment = message ? null : M.assess(r);
  const signalKeys = message
    ? r.signals || S.inspect(r.text).map((s) => s.key)
    : assessment.signals;
  const picture = message
    ? `<span aria-hidden="true" class="avatar report-avatar">${icon("message", 17)}</span>`
    : avatar(r);
  return `<tr><td><button class="record-link" data-a="${action}">${picture}
    <span><strong>${itemName(r)}</strong><small>${itemId(r)}${compact ? "" : " · " + date(analyst ? r.time : r.log.at(-1).time)}</small></span></button></td>
    <td class="amount">${message ? "—" : money(r.amount)}</td>
    ${
      compact
        ? ""
        : `<td class="activity-risk">${
            message
              ? badge(
                  S.level(signalKeys),
                  analyst
                    ? S.level(signalKeys)
                    : signalKeys.length
                      ? "shortMessageWarning"
                      : "shortMessageClear",
                )
              : transferRiskCell(assessment, analyst)
          }</td>`
    }
    <td>${message ? badge(r.status) : transferBadge(r)}</td>
    ${analyst ? `<td class="queue-signals">${signalKeys.map(t).join(" · ") || t(message ? "messageClear" : "noSignals")}</td>` : ""}</tr>`;
}
function transferRiskCell(assessment, analyst) {
  return (
    badge(assessment.level) +
    (analyst
      ? `<small class="row-score">${assessment.score} ${t("scoreUnit")}</small>`
      : "")
  );
}
function matchesStatus(r, selected) {
  if (selected === "open") return active(r);
  if (selected === "actionable")
    return ["confirmed", "held", "submitted"].includes(r.status);
  if (selected === "closed") return !active(r);
  return !selected || r.status === selected;
}
function riskLevel(record) {
  return isReport(record)
    ? S.level(S.inspect(record.text).map((s) => s.key))
    : M.assess(record).level;
}
function filtered() {
  const analyst = staffQueue();
  const term = search.trim().toLocaleLowerCase();
  const results = items().filter(
    (record) =>
      matchesStatus(record, filter) &&
      (page !== "reports" || isReport(record)) &&
      (page !== "history" || historyKind === "all" || isReport(record)) &&
      (
        itemId(record) +
        " " +
        itemName(record) +
        (analyst ? " " + (profileName(W.ownerOf(record)) ?? "") : "")
      )
        .toLocaleLowerCase()
        .includes(term) &&
      (!analyst ||
        ((!queueFilters.risk || riskLevel(record) === queueFilters.risk) &&
          N.fitsTime(record, queueFilters.days))),
  );
  if (!analyst) return results;
  if (queueFilters.sort === "newest")
    return results.sort((a, b) => b.time - a.time);
  if (queueFilters.sort === "oldest")
    return results.sort((a, b) => a.time - b.time);
  if (queueFilters.sort === "strongest") {
    const order = { high: 0, medium: 1, low: 2 };
    return results.sort(
      (a, b) => order[riskLevel(a)] - order[riskLevel(b)] || priority(a, b),
    );
  }
  return results.sort(priority);
}
function filterSelect(id, label, value, options) {
  return `<label class="filter-field">${t(label)}<select id="${id}">${options.map(([key, text]) => opt(key, value, t(text))).join("")}</select></label>`;
}
const riskOptions = [
  ["", "allRisk"],
  ["high", "high"],
  ["medium", "medium"],
  ["low", "low"],
];
const periodOptions = [
  ["", "allDates"],
  ["1", "lastDay"],
  ["7", "lastWeek"],
  ["30", "lastMonth"],
];
function queueSummary() {
  const cases = items().filter((r) =>
    page === "reports" ? isReport(r) : isReport(r) || r.flagged,
  );
  return `<div class="queue-summary" role="group" aria-label="${t("queueGroups")}">
    ${[
      ["open", "queueOpen"],
      ["actionable", "queueAction"],
      ["requested", "queueWaiting"],
      ["closed", "queueClosed"],
    ]
      .map(
        ([value, label]) =>
          `<button data-a="queue:${value}" aria-pressed="${filter === value}"><span>${t(label)}</span>
      <strong>${cases.filter((r) => matchesStatus(r, value)).length}</strong></button>`,
      )
      .join("")}</div>`;
}
function analystBrief(r, signals, matches = []) {
  const message = isReport(r);
  const brief = W.caseBrief(r, {
    signals,
    weights: M.weights,
    mismatch: !message && M.hasMismatch(r),
    canRelease: !message && M.canRelease(r),
    attested: !message && M.verification(r)?.event === "answer",
  });
  const evidence = brief.evidence
    .map((key) => {
      if (!message) {
        return `<li><strong>${t(key)} <small>+${M.weights[key]}</small></strong>
        <p>${esc(signalEvidence(r, key))}</p></li>`;
      }
      const { start, end } = matches.find((match) => match.key === key);
      const excerpt = r.text.slice(start, Math.min(end, start + 110));
      return `<li><strong>${t(key)}</strong>
      <q>${esc(excerpt)}${end - start > 110 ? "…" : ""}</q></li>`;
    })
    .join("");
  return `<section class="panel pad analyst-brief">
    <h2>${icon("scan", 18)}${t("assistantBrief")}</h2>
    <p>${t(brief.next)}</p>
    <dl>${pair("customerRole", profileName(W.ownerOf(r)) ?? t("unknownDemoCustomer"))}
    ${pair("status", t(brief.status))}
    ${pair("recentEvent", t(brief.event) + (brief.reason ? " · " + t(brief.reason) : ""))}</dl>
    ${
      evidence
        ? `<h3>${t("briefKeyEvidence")}</h3><ul class="brief-evidence">${evidence}</ul>`
        : `<p class="brief-empty">${t(message ? "briefNoMessageEvidence" : "noSignals")}</p>`
    }
    <p class="brief-limit">${t(brief.gap)}</p>
    <small>${t("assistantCaption")}</small></section>`;
}
function queuePreview(r) {
  if (!r) return "";
  const message = isReport(r);
  const signals = message
    ? S.inspect(r.text).map((s) => s.key)
    : M.assess(r).signals;
  return `<section class="panel pad queue-preview">
    <small>${itemId(r)}</small><h2>${message ? itemName(r) : money(r.amount)}</h2>
    ${message ? badge(r.status) : transferBadge(r)}
    <h3>${t("signals")}</h3>
    ${signals.length ? `<ul>${signals.map((k) => "<li>" + t(k) + "</li>").join("")}</ul>` : `<p>${t(message ? "messageClear" : "noSignals")}</p>`}
    ${button("queue-current", message ? "messageReviewTitle" : "openReview", "primary", "right")}</section>`;
}
function listPage() {
  const analyst = staffQueue();
  const onlyReports =
    page === "reports" || (!analyst && historyKind === "reports");
  const statuses = onlyReports
    ? S.statuses
    : [
        ...(analyst ? M.statuses.filter((s) => s !== "pending") : M.statuses),
        ...S.statuses,
        ...(analyst ? [] : ["summarySaved"]),
      ];
  const groups = analyst
    ? [
        ["open", "queueOpen"],
        ["actionable", "queueAction"],
        ["closed", "queueClosed"],
      ]
    : [];
  return `${heading(analyst ? page : "activityTitle")}
    ${
      analyst
        ? queueSummary()
        : `<div class="list-tabs" role="group" aria-label="${t("historyTypes")}">
      ${["all", "reports"].map((mode) => `<button type="button" class="btn secondary" data-a="history-mode:${mode}" aria-pressed="${mode === historyKind}">${t(mode === "all" ? "allHistory" : "myReports")}</button>`).join("")}</div>`
    }
    <div class="${analyst ? "queue-workspace" : ""}"><section class="panel list-panel"><div class="filters">
      <label class="search">${icon("search", 17)}<input id="search" type="search" autocomplete="off"
        aria-label="${t("search")}" placeholder="${t("search")}" value="${esc(search)}"></label>
      <select id="statusFilter" aria-label="${t("status")}">
        ${[...groups, ["", "allStatus"], ...statuses.map((k) => [k, k])].map(([k, label]) => opt(k, filter, t(label))).join("")}
      </select></div>
      ${
        analyst
          ? `<div class="review-filters">
        ${filterSelect("queueRisk", "riskFilter", queueFilters.risk, riskOptions)}
        ${filterSelect("queueDays", "periodFilter", queueFilters.days, periodOptions)}
        ${filterSelect("queueSort", "sortFilter", queueFilters.sort, [
          ["priority", "casePriority"],
          ["newest", "newest"],
          ["oldest", "oldest"],
          ["strongest", "strongest"],
        ])}
        ${button("clear-queue", "clearFilters", "text-btn")}</div>`
          : ""
      }
      <div id="results">${table(filtered(), analyst ? "case" : "detail")}</div>
    </section>${analyst ? `<div id="queuePreview">${queuePreview(filtered()[0])}</div>` : ""}</div>`;
}
function updateList() {
  $("#results").innerHTML = table(filtered(), staffQueue() ? "case" : "detail");
  if ($("#queuePreview"))
    $("#queuePreview").innerHTML = queuePreview(filtered()[0]);
  $("#statusFilter").value = filter;
  document
    .querySelectorAll(".queue-summary button")
    .forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.a === "queue:" + filter),
    );
}
function helpPage() {
  return `${heading("help", "helpIntro")}
    <div class="task-sheet">
    <section><h2>${t("helpMessage")}</h2><p>${t("helpMessageBody")}</p>${button("nav:checkMessage", "checkMessage", "secondary", "message")}</section>
    <section><h2>${t("helpTransfer")}</h2><p>${t("helpTransferBody")}</p>${button("nav:transfer", "transfer", "secondary", "send")}</section>
    <section><h2>${t("helpReport")}</h2><p>${t("helpReportBody")}</p>${button("help-reports", "myReports", "secondary", "history")}</section>
    </div>`;
}
const decisionEvents = new Set([
  "request",
  "keep",
  "release",
  "falseAlarm",
  "stop",
  "advised",
  "inconclusive",
]);
function decisionRows() {
  const term = decisionSearch.trim().toLocaleLowerCase();
  return items()
    .flatMap((record) =>
      record.log
        .filter((entry) => decisionEvents.has(entry.event))
        .map((entry) => ({ record, entry })),
    )
    .filter(
      ({ record, entry }) =>
        (!decisionScope || entry.event === decisionScope) &&
        (
          itemId(record) +
          " " +
          (entry.actor?.name ?? "") +
          " " +
          t(entry.event)
        )
          .toLocaleLowerCase()
          .includes(term),
    )
    .sort((a, b) => b.entry.time - a.entry.time);
}
function decisionsTable() {
  const data = decisionRows();
  return data.length
    ? `<div class="table-wrap"><table class="full decisions-table">
    <thead><tr><th scope="col">${t("decisionCase")}</th><th scope="col">${t("recentEvent")}</th><th scope="col">${t("decisionAuthor")}</th><th scope="col">${t("decisionReason")}</th><th scope="col">${t("date")}</th></tr></thead>
    <tbody>${data
      .map(
        ({ record, entry }) => `<tr>
      <td><button type="button" class="text-btn" data-a="${isReport(record) ? "message-case:" : "case:"}${record.id}">${itemId(record)}</button></td>
      <td>${t(entry.event)}</td><td>${esc(entry.actor?.name ?? t("legacyActor"))}</td>
      <td>${entry.reason ? t(entry.reason) : "—"}</td><td>${date(entry.time)}</td>
    </tr>`,
      )
      .join("")}</tbody></table></div>`
    : `<div class="empty"><h3>${t("noDecisions")}</h3><p>${t("noDecisionsHelp")}</p>${button("nav:analyst", "analyst", "secondary", "scan")}</div>`;
}
function decisionsPage() {
  return `${heading("decisions", "decisionsIntro")}<div class="panel">
    <div class="review-filters"><label class="filter-field">${t("decisionSearch")}<input id="decisionSearch" type="search" autocomplete="off" value="${esc(decisionSearch)}"></label>
      ${filterSelect("decisionScope", "recentEvent", decisionScope, [["", "allDecisions"], ...[...decisionEvents].map((event) => [event, event])])}</div>
    <div id="decisionResults">${decisionsTable()}</div></div>`;
}
function rulesPage() {
  const assessment = M.assess(M.scenarios[ruleExample]);
  const trial =
    assessment.score >= sandboxHigh
      ? "high"
      : assessment.score >= sandboxLow
        ? "medium"
        : "low";
  return `${heading("rules", "rulesIntro")}
    <div class="rules-layout"><section class="panel pad"><h2>${t("sandboxTitle")}</h2>
      <form id="rulesForm" class="rule-form" novalidate>
        ${filterSelect(
          "ruleExample",
          "scenario",
          ruleExample,
          Object.keys(M.scenarios).map((key) => [key, key]),
        )}
        <label class="filter-field">${t("sandboxLow")}<input id="sandboxLow" type="number" min="1" max="429" value="${sandboxLow}" required></label>
        <label class="filter-field">${t("sandboxHigh")}<input id="sandboxHigh" type="number" min="2" max="430" value="${sandboxHigh}" required></label>
        <p class="entry-error" id="ruleError" role="alert"></p>
        <button class="btn primary" type="submit">${t("evaluateRules")}</button>
      </form>
      <dl class="rule-result" id="ruleResult" aria-live="polite">${pair("score", assessment.score)}${pair("productionRisk", t(assessment.level))}${pair("sandboxRisk", t(trial))}</dl>
      ${assessment.signals.length ? `<p class="rule-signals">${assessment.signals.map(t).join(" · ")}</p>` : ""}
    </section><section class="panel pad"><h2>${t("ruleWeights")}</h2>
      <dl>${Object.entries(M.weights)
        .map(([signal, score]) => pair(signal, "+" + score))
        .join("")}</dl>
    </section></div>`;
}
function networkRecords() {
  return rows
    .filter((r) => W.allowed(actor(), "case", r))
    .filter(
      (r) =>
        matchesStatus(r, networkFilters.status) &&
        (!networkFilters.risk || riskLevel(r) === networkFilters.risk) &&
        N.fitsTime(r, networkFilters.days),
    )
    .map((r) => ({
      ...r,
      owner: W.ownerOf(r),
      customerName: profileName(W.ownerOf(r)) ?? t("unknownDemoCustomer"),
      recipientName: M.recipients[r.recipient].name,
      level: riskLevel(r),
    }))
    .sort((a, b) => b.time - a.time || b.id - a.id);
}
function networkPage() {
  return `${heading("network", "networkIntro")}
    <div class="panel network-filterbar review-filters">
      ${filterSelect("networkStatus", "status", networkFilters.status, [
        ["", "allStatus"],
        ["open", "queueOpen"],
        ["closed", "queueClosed"],
      ])}
      ${filterSelect("networkRisk", "riskFilter", networkFilters.risk, riskOptions)}
      ${filterSelect("networkDays", "periodFilter", networkFilters.days, periodOptions)}
      ${button("clear-network", "clearFilters", "text-btn")}
    </div>
    <div class="network-mode" role="group" aria-label="${t("networkMode")}">
      <button class="btn secondary" data-a="network-mode:space" aria-pressed="${networkMode === "space"}" ${graphicsUnavailable ? "disabled" : ""}>${t("view3d")}</button>
      <button class="btn secondary" data-a="network-mode:list" aria-pressed="${networkMode === "list"}">${t("viewList")}</button>
    </div>
    <p id="networkFallback" class="network-caption" ${graphicsUnavailable ? "" : "hidden"}>${t("networkFallback")}</p>
    <div id="networkBody"></div>`;
}
function mountNetwork() {
  networkCanvas?.dispose();
  networkCanvas = null;
  const host = $("#networkBody");
  if (!host) return;
  const records = networkRecords();
  const graph = N.layout(records);
  if (!graph.nodes.some((n) => n.id === networkSelection.node))
    networkSelection.node = "";
  if (!records.some((r) => r.id === networkSelection.edge))
    networkSelection.edge = null;
  if (!records.length) {
    host.innerHTML = `<div class="panel pad empty"><h2>${t("queueEmpty")}</h2><p>${t("networkEmpty")}</p></div>`;
    return;
  }
  host.innerHTML = `<div class="network-layout">
    <section class="panel network-board">
      ${
        networkMode === "space"
          ? `<div class="network-viewport">
        <canvas id="networkCanvas" tabindex="0" role="img" aria-label="${t("networkKeyboard")}"></canvas>
        <div class="network-legend">
          <span class="network-customer">${t("customerRole")}</span><span class="network-recipient">${t("recipient")}</span><span class="network-dash">${t("high")}</span>
        </div></div>
        <div class="network-tools" role="group" aria-label="${t("networkCamera")}">
          ${cameraButtons("camera")}
        </div><p class="network-caption">${t("networkHow")}</p>`
          : ""
      }
      <div class="network-picker">
        <label class="filter-field">${t("filterNode")}<select id="networkNode">
          ${opt("", networkSelection.node, t("allNodes"))}
          ${graph.nodes.map((n) => opt(n.id, networkSelection.node, (n.type === "customer" ? t("customerRole") : t("recipient")) + " · " + n.label)).join("")}
        </select></label>
        <div id="networkLinks"></div>
      </div>
    </section>
    <aside class="panel pad network-inspect" id="networkInspect" aria-live="polite"></aside></div>`;
  updateNetworkSelection(records);
  const canvas = $("#networkCanvas");
  if (!canvas) return;
  networkCanvas = N.attach(canvas, graph, networkSelection, (hit) =>
    selectNetwork(hit.node, hit.edge),
  );
  if (!networkCanvas) {
    graphicsUnavailable = true;
    networkMode = "list";
    $("[data-a='network-mode:space']").disabled = true;
    $("#networkFallback").hidden = false;
    $("[data-a='network-mode:list']").setAttribute("aria-pressed", "true");
    $("[data-a='network-mode:space']").setAttribute("aria-pressed", "false");
    mountNetwork();
  }
}
function updateNetworkSelection(records) {
  const matches = records.filter(
    (r) =>
      !networkSelection.node ||
      ["customer:" + r.owner, "recipient:" + r.recipient].includes(
        networkSelection.node,
      ),
  );
  $("#networkNode").value = networkSelection.node;
  if (!matches.some((r) => r.id === networkSelection.edge))
    networkSelection.edge = null;
  $("#networkLinks").innerHTML = `<ul class="network-links">${matches
    .map(
      (r) =>
        `<li><button type="button" data-a="network-edge:${r.id}" aria-pressed="${r.id === networkSelection.edge}">
      <span><strong>${itemId(r)} · ${money(r.amount)}</strong><small>${esc(r.customerName)} → ${esc(r.recipientName)}</small></span>
      <span><small>${date(r.time)}</small>${badge(r.level)}</span>
    </button></li>`,
    )
    .join("")}</ul>`;
  const record = matches.find((r) => r.id === networkSelection.edge);
  $("#networkInspect").innerHTML = record
    ? `<h2>${itemId(record)} · ${money(record.amount)}</h2>
    <dl>${pair("status", t(record.status))}${pair("date", date(record.time))}
    ${pair("purposeSource", t(record.purpose))}</dl>
    <h3>${t("signals")}</h3>
    ${
      M.assess(record).signals.length
        ? `<ul>${M.assess(record)
            .signals.map((k) => `<li>${t(k)}</li>`)
            .join("")}</ul>`
        : `<p>${t("noSignals")}</p>`
    }
    ${button("case:" + record.id, "openReview", "primary", "right")}`
    : `<h2>${t("networkDetails")}</h2><p>${t("selectTransfer")}</p>`;
}
function selectNetwork(node, edge, restoreFocus = false) {
  if (node !== undefined)
    networkSelection.node =
      node === networkSelection.node && !restoreFocus ? "" : node;
  if (edge !== undefined) {
    networkSelection.edge = edge;
    const candidate = networkRecords().find((r) => r.id === edge);
    if (
      candidate &&
      ![
        "customer:" + candidate.owner,
        "recipient:" + candidate.recipient,
      ].includes(networkSelection.node)
    )
      networkSelection.node = "";
  }
  updateNetworkSelection(networkRecords());
  networkCanvas?.paint();
  if (restoreFocus && edge !== undefined)
    $('[data-a="network-edge:' + edge + '"]')?.focus();
}
function relatedTransfers(r) {
  const { same, viaCustomer } = N.related(r, rows, W.ownerOf);
  const link = (record) =>
    `<li><button class="text-btn" data-a="case:${record.id}">${itemId(record)} · ${esc(M.recipients[record.recipient].name)} · ${money(record.amount)}<span>${date(record.time)}</span></button></li>`;
  const list = (title, records) =>
    records.length
      ? `<h3>${t(title)}</h3><ul>${records.map(link).join("")}</ul>`
      : "";
  return `<section class="panel pad related-cases"><h2>${t("relatedCases")}</h2>
    ${list("sameRecipient", same)}${list("sameCustomer", viaCustomer)}
    ${!same.length && !viaCustomer.length ? `<p>${t("noRelated")}</p>` : ""}
    ${button("network-recipient:" + r.recipient, "showNetwork", "text-btn", "network")}</section>`;
}
function highlightedMessage(text, signals) {
  const spans = signals
    .map(({ start, end, key }) => ({ start, end, keys: [key] }))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span.start < last.end) {
      last.end = Math.max(last.end, span.end);
      last.keys.push(...span.keys);
    } else merged.push(span);
  }
  let from = 0,
    html = "";
  for (const span of merged) {
    html +=
      esc(text.slice(from, span.start)) +
      `<mark tabindex="-1" data-signals="${span.keys.join(" ")}">${esc(text.slice(span.start, span.end))}</mark>`;
    from = span.end;
  }
  return html + esc(text.slice(from));
}
function messageEvidence(text, signals, studio = false) {
  const list = signals
    .map(
      ({
        key,
      }) => `<li><button class="evidence-link" data-a="evidence:${key}" aria-label="${t("showEvidencePhrase")} ${t(key)}">${icon("search", 15)}${t(key)}</button>
    <p>${t(key + "Advice")}</p></li>`,
    )
    .join("");
  const level = S.level(signals.map((s) => s.key));
  const label = {
    high: "messagePause",
    medium: "messageCheck",
    low: "messageQuiet",
  }[level];
  const quote = `<div class="evidence-topline">${badge(level, label)}<small>${t("signalCount")} · ${signals.length}</small></div>
    <h2 tabindex="-1" id="messageEvidenceHeading">${t("messageSummaryTitle")}</h2>
    <blockquote class="message-quote" aria-label="${t("messageEvidence")}">${highlightedMessage(text, signals)}</blockquote>`;
  const reasons = `<h3>${t("messageWhy")}</h3>${list ? `<ul class="message-signals">${list}</ul>` : `<p>${t("messageClearTip")}</p>`}
    ${
      studio && useSimilarity
        ? `<div class="similarity-result"><strong>${t("similarExample")}</strong>
      ${messageHint ? `<p>${t(messageHint.category)}</p><q>${esc(messageHint.example)}</q>` : `<p>${t("noSimilarity")}</p>`}</div>`
        : ""
    }
    <p class="message-limits">${t("messageLimits")}</p>`;
  return studio
    ? `<section class="panel pad message-evidence">${quote}</section><section class="panel pad message-rationale">${reasons}</section>`
    : `<section class="panel pad message-evidence">${quote}${reasons}</section>`;
}
function voiceControls() {
  const state = V.state(),
    recording = state === "voiceRecording";
  return `<p>${t("voiceIntro")}</p><div class="voice-actions">
    ${state === "voiceWaiting" ? "" : button(recording ? "voice-stop" : "voice-record", recording ? "voiceStop" : "voiceRecord", "secondary", recording ? "stop" : "mic")}
    ${recording ? "" : `<label class="voice-file">${t("voiceLoad")}<input type="file" id="voiceFile" accept="audio/*"></label>`}
    ${V.source() ? button("voice-remove", "voiceRemove", "text-btn", "close") : ""}</div>
    <p class="voice-status" role="status">${state === "idle" ? "" : t(state)}</p>
    ${V.source() ? `<audio id="voicePlayback" controls src="${esc(V.source())}"></audio><p id="audioError" role="alert"></p>` : ""}`;
}
function studioResult() {
  const signals = S.inspect(checkedMessage);
  const level = S.level(signals.map((s) => s.key));
  return `${heading("studioResult")}
    <div class="message-workspace studio-results"><div id="messageResult">${messageEvidence(checkedMessage, signals, true)}</div>
    <div class="stack studio-actions"><section class="panel pad next-step">${icon("shield", 26)}<h2>${t("safeNext")}</h2>
      <p>${t(level === "high" ? "nextHigh" : level === "medium" ? "nextMedium" : "messageClearTip")}</p>
      ${button("message-transfer", "openTransferReview", "primary", "send")}</section>
    <section class="panel pad result-actions">
      ${reportSummaryId ? button("message-summary:" + reportSummaryId, "openSummary", "secondary", "bookmark") : button("save-summary", "saveSummary", "secondary", "bookmark")}
      ${button("report-message", "reportMessage", "secondary", "flag")}
      ${button("message-edit", "editMessage", "text-btn", "back")}${button("message-new", "startAnotherCheck", "text-btn")}
      <p>${t("summaryPrivacy")}</p></section></div></div>`;
}
function messagePage() {
  if (checkedMessage !== null) return studioResult();
  return `${heading("studio")}
    <div class="studio-compose panel pad">
      <div class="mode-switch" role="group" aria-label="${t("messageModes")}">
        ${["text", "voice"].map((k) => `<button data-a="mode:${k}" aria-pressed="${k === mode}">${icon(k === "text" ? "message" : "mic", 20)}${t(k === "text" ? "textMode" : "voiceMode")}</button>`).join("")}
      </div>
      ${mode === "voice" ? `<section id="voiceTools">${voiceControls()}</section>` : ""}
      <form id="messageForm" novalidate>
        <label for="messageInput">${t(mode === "voice" ? "audioTranscript" : "messageText")}</label>
        <textarea id="messageInput" rows="6" maxlength="${S.maxLength}" placeholder="${t("messagePlaceholder")}" aria-describedby="messageHelp messageError" required spellcheck="false">${esc(messageDraft)}</textarea>
        <div class="compose-meta"><p id="messageHelp">${t("studioPrivacy")}</p><small id="messageCount">${messageDraft.length}/${S.maxLength}</small></div>
        <p id="messageError" role="alert"></p>
        <label class="similarity-option"><input id="similarityOption" type="checkbox" ${useSimilarity ? "checked" : ""}><span>${t("localSimilarity")}</span></label>
        <button type="submit" class="btn primary">${icon("scan", 19)}${t("checkMessage")}</button>
      </form>
    </div>
    <section class="message-practice"><h2>${t("practiceTitle")}</h2><div class="sample-buttons">
      ${["bank", ...Object.keys(messageExamples).filter((k) => k !== "bank")].map((k) => button("message-sample:" + k, "sample_" + k, "sample-choice", "message")).join("")}
    </div></section>`;
}
function summaryDetail() {
  const r = summaries.find((s) => s.id === activeId);
  const signals = r.signals
    .map((k) => `<li><strong>${t(k)}</strong><p>${t(k + "Advice")}</p></li>`)
    .join("");
  return `${button("nav:history", "activityTitle", "text-btn back", "back")}
    <div class="page-heading"><h1>${t("summarySaved")} ${itemId(r)}</h1><small>${date(r.time)}</small></div>
    <section class="panel pad message-evidence"><h2>${t("signalResult")}</h2>
      ${signals ? `<ul class="message-signals">${signals}</ul>` : `<p>${t("messageClear")}</p>`}
      ${r.category ? `<p>${t("similarExample")} · ${t(r.category)}</p>` : ""}
      <p class="message-limits">${t("summaryPrivacy")}</p>${button("message-new", "startAnotherCheck", "primary")}</section>`;
}
function messageDetail() {
  const r = reports.find((r) => r.id === activeId);
  const matches = S.inspect(r.text);
  const analyst = page === "message-case";
  const result = r.log.at(-1);
  const back = analyst ? caseOrigin : "history";
  const switchView = button(
    (analyst ? "message-detail:" : "message-case:") + r.id,
    analyst ? "customer" : "analystView",
    "text-btn",
    analyst ? "user" : "scan",
  );
  return `${button("nav:" + back, analyst ? back : "activityTitle", "text-btn back", "back")}
    <div class="page-heading"><h1>${t(analyst ? "messageReviewTitle" : "messageReportTitle")} ${itemId(r)}</h1>${badge(r.status)}</div>
    <div class="message-workspace report-workspace">${messageEvidence(r.text, matches)}
      <div class="stack">${
        analyst
          ? analystBrief(
              r,
              matches.map((signal) => signal.key),
              matches,
            )
          : ""
      }<section class="panel pad decision"><h2>${t(analyst ? "analystDecision" : "next")}</h2>
        <p>${t(analyst && r.status === "submitted" ? "messageDecide" : r.status + "Help")}</p>
        ${result.reason ? `<p class="outcome-note"><strong>${t("decisionReason")}</strong>${t(result.reason)}</p>` : ""}
        <div class="action-row">${
          analyst && r.status === "submitted"
            ? button("message-outcome:advised", "issueAdvice", "primary") +
              button("message-outcome:inconclusive", "closeInconclusive")
            : ""
        }
         ${switchView}${analyst ? "" : button("message-new", "startAnotherCheck")}</div>
      </section>${auditPanel(r)}${analyst ? notePanel(r) : ""}</div>
    </div>`;
}
function selectField(key, options, d = key) {
  return (
    "<label>" +
    t(key) +
    '<select id="' +
    d +
    '" name="' +
    d +
    '"' +
    (d === "recipient" ? ' aria-describedby="recipientCheck"' : "") +
    " required>" +
    opt("", draft[d], t("choose")) +
    options.map(([k, l]) => opt(k, draft[d], l)).join("") +
    "</select></label>"
  );
}
function transferSteps(review = false) {
  return `<ol class="transfer-steps" aria-label="${t("transferSteps")}">
    <li ${review ? "" : 'aria-current="step"'}><span>1</span>${t("enterDetails")}</li>
    <li ${review ? 'aria-current="step"' : ""}><span>2</span>${t("reviewDetails")}</li></ol>`;
}
function contextFields(keys) {
  return keys
    .map(
      (k) =>
        `<label class="context-choice"><input type="checkbox" name="context" value="${k}" ${draft.context?.includes(k) ? "checked" : ""}>${t(k)}</label>`,
    )
    .join("");
}
function recipientHint(id) {
  const recipient = M.recipients[id];
  return recipient
    ? t(recipient.known ? "demoRecipientKnown" : "demoRecipientNew")
    : "";
}
function form() {
  return (
    heading("transfer", "formSub") +
    transferSteps() +
    '<div class="form-grid"><section class="panel pad"><div class="card-heading"><h2>' +
    t("details") +
    "</h2>" +
    icon("send") +
    "</div>" +
    (draftScenario
      ? '<p class="context">' +
        (["correctionForm", "fromMessage"].includes(draftScenario)
          ? t(draftScenario)
          : t("scenario") + " · " + t(draftScenario)) +
        "</p>"
      : "") +
    '<form id="transferForm" novalidate>' +
    selectField(
      "recipient",
      Object.entries(M.recipients).map(([k, p]) => [k, p.name]),
    ) +
    `<p id="recipientCheck" class="recipient-hint" aria-live="polite">${recipientHint(draft.recipient)}</p>` +
    "<label>" +
    t("amount") +
    '<span class="money-input"><input name="amount" id="amount" type="text" inputmode="numeric" maxlength="12" value="' +
    esc(draft.amount ?? "") +
    '" aria-describedby="amountHint" required><b>₸</b></span><small id="amountHint">' +
    t("amountHint") +
    "</small></label>" +
    selectField(
      "purpose",
      M.purposes.map((k) => [k, t(k)]),
    ) +
    selectField(
      "activityLabel",
      Object.keys(M.activity).map((k) => [k, t(k)]),
      "activity",
    ) +
    `<label class="code-question"><input type="checkbox" name="codeRequested" id="codeRequested" ${draft.codeRequested ? "checked" : ""}><span><strong>${t("codeLabel")}</strong><small>${t("codeHint")}</small></span></label>` +
    `<fieldset class="transfer-context"><legend>${t("circumstances")}</legend>${contextFields(M.circumstances)}</fieldset>
      <details class="device-context" ${M.devices.some((k) => draft.context?.includes(k)) ? "open" : ""}><summary>${t("deviceSim")}</summary>
      <small>${t("deviceSimHelp")}</small>${contextFields(M.devices)}</details>` +
    '<div id="errors" role="alert"></div><button class="btn primary">' +
    t("review") +
    icon("arrow", 16) +
    "</button></form></section>" +
    '<div class="stack"><section class="panel pad transfer-profile"><h2>' +
    t("transferProfile") +
    "</h2><dl>" +
    pair("typicalShort", money(M.previousAmounts[1])) +
    pair(
      "familiarRecipients",
      Object.values(M.recipients).filter((r) => r.known).length,
    ) +
    "</dl><small>" +
    t("profileSim") +
    "</small></section>" +
    scenList() +
    "</div></div>"
  );
}
function signalEvidence(r, signal) {
  switch (signal) {
    case "newRecipient":
      return M.recipients[r.recipient].name + " · " + t("fresh");
    case "large":
      return (
        money(r.amount) +
        " / " +
        money(M.previousAmounts[1]) +
        " (" +
        t("typicalShort") +
        ")"
      );
    case "velocity":
      return (
        t("lastTen") +
        ": " +
        M.activity[r.activity].filter((m) => m >= -10).length
      );
    case "pressure":
      return t("purpose") + ": " + t(r.purpose);
    case "codeRequest":
      return t("customerReported") + ": " + t("codeLabel");
    default:
      return t(
        M.devices.includes(signal) ? "deviceSimHelp" : "customerReported",
      );
  }
}
function riskPanel(r, analyst) {
  const a = M.assess(r);
  const signals = a.signals
    .map(
      (k) =>
        `<li><div><strong>${t(k)}</strong><small>${signalEvidence(r, k)}</small></div><b>+${M.weights[k]}</b></li>`,
    )
    .join("");
  return `<section class="panel pad assessment"><div class="card-heading"><h2>${t("assessment")}</h2>${badge(a.level)}</div>
    <div class="score"><strong>${a.score}</strong><span>${t("score")}</span></div>
    ${
      signals
        ? analyst || a.signals.length <= 2
          ? `<ul class="evidence-list">${signals}</ul>`
          : `<details class="risk-disclosure"><summary>${t("signalBreakdown")}</summary><ul class="evidence-list">${signals}</ul></details>`
        : `<p>${t("noSignals")}</p>`
    }
    <small>${t("ruleNote")}</small></section>`;
}
function observed(r) {
  return (
    '<section class="panel pad observed"><h2>' +
    t("observed") +
    "</h2><dl>" +
    pair("recipient", t(M.recipients[r.recipient].known ? "known" : "fresh")) +
    pair("typical", money(18000)) +
    pair("previousAmounts", M.previousAmounts.map(money).join(" / ")) +
    pair("recentCount", M.activity[r.activity].filter((m) => m >= -10).length) +
    pair("before", M.activity[r.activity].map(Math.abs).join(" / ")) +
    "</dl><small>" +
    t("snapshotNote") +
    "</small></section>"
  );
}
function actions(r, analyst) {
  const e = (k, l, style) => button("act:" + k, l, style);
  let controls = "",
    help = "";
  if (analyst) {
    help =
      {
        held:
          M.needsVerification(r) && !M.canRelease(r)
            ? "verifyCaseHeld"
            : "caseHeld",
        requested: "caseRequested",
        confirmed: "caseConfirmed",
      }[r.status] || r.status + "Help";
    if (r.status === "held" && M.hasMismatch(r)) help = "analystMismatch";
    if (r.status === "held" && !M.hasMismatch(r))
      controls = e("request", "askBtn", "primary");
    if (r.status === "requested" || r.status === "confirmed")
      controls += e("keep", "keepBtn");
    if (M.canRelease(r))
      controls += e("release", "releaseBtn") + e("falseAlarm", "falseBtn");
    if (active(r)) controls += e("stop", "stopBtn", "danger");
    controls += button("detail:" + r.id, "customer", "text-btn", "right");
  } else if (r.status === "pending") {
    const l = M.assess(r).level;
    help = l === "high" ? "highHelp" : "previewHelp";
    if (l === "low") controls = e("pay", "confirmPay", "primary");
    if (l === "medium") controls = e("checkedPay", "verifyStart", "primary");
    controls +=
      e("hold", "holdBtn", l === "high" ? "primary" : "secondary") +
      button("edit", "editBtn") +
      e("cancel", "cancelBtn", "quiet");
  } else {
    help =
      r.status === "held" && M.verification(r)?.event === "deferVerification"
        ? "deferredHelp"
        : r.status + "Help";
    if (r.status === "requested")
      controls =
        e("answer", "verifyStart", "primary") +
        e("mismatch", "mismatchBtn") +
        e("deferVerification", "deferBtn") +
        e("dispute", "disputeBtn", "danger");
    if (r.status === "held" && M.hasMismatch(r)) {
      help = "customerMismatch";
      controls = button("correct", "correctBtn", "primary");
    }
    if (active(r)) controls += e("cancel", "cancelBtn", "quiet");
    if (r.flagged)
      controls += button("case:" + r.id, "analystView", "text-btn", "scan");
    if (!active(r))
      controls += button("nav:transfer", "transfer", "secondary", "send");
  }
  const reason = r.log.at(-1).reason;
  const outcome =
    !active(r) && r.status !== "pending" && reason
      ? `<p class="outcome-note"><strong>${t("decisionReason")}</strong> ${t(reason)}</p>`
      : "";
  return (
    '<section class="panel pad decision"><h2>' +
    t(
      analyst
        ? "analystDecision"
        : r.status === "pending"
          ? "decision"
          : "next",
    ) +
    "</h2><p>" +
    t(help) +
    "</p>" +
    outcome +
    '<div class="action-row">' +
    controls +
    "</div></section>"
  );
}
function verificationPanel(r) {
  const entry = M.verification(r);
  if (!entry) return "";
  let label = "resultClosed";
  if (entry.event === "answer")
    label = entry.channel ? "resultMatched" : "resultLegacy";
  else if (entry.event === "mismatch") label = "reportedMismatch";
  else if (entry.event === "deferVerification")
    label = active(r) ? "resultDeferred" : "resultDeferredClosed";
  else if (r.status === "requested") label = "resultWaiting";
  else if (active(r)) label = "resultUnanswered";
  return `<section class="panel pad response-card">
    <h2>${icon("user", 17)}${t("verificationResult")}</h2><p>${t(label)}</p>
    ${entry.reason ? `<p class="mismatch-note">${t(entry.reason)}</p>` : ""}
    ${entry.channel ? `<dl>${pair("verifyChannel", t(entry.channel))}</dl><small>${t("reportedOnly")}</small>` : ""}
  </section>`;
}
function editValue(field, value) {
  if (field === "amount") return money(value);
  if (field === "recipient") return M.recipients[value].name;
  if (field === "context") return value?.map(t).join(" · ") || t("noValue");
  if (field === "codeRequested") return t(value ? "yesValue" : "noValue");
  return t(value);
}
function editSummary(before, after) {
  const fields = {
    recipient: "recipient",
    amount: "amount",
    purpose: "purpose",
    activity: "activityLabel",
    codeRequested: "codeLabel",
    context: "circumstances",
  };
  const changes = M.editFields
    .filter((k) => M.fieldChanged(k, before, after))
    .map(
      (k) =>
        `<li><strong>${t(fields[k])}</strong><span>${esc(editValue(k, before[k]))} → ${esc(editValue(k, after[k]))}</span></li>`,
    )
    .join("");
  return `<details class="revision"><summary>${t("changes")} · ${M.assess(before).score} → ${M.assess(after).score} ${t("scoreUnit")}</summary><ul>${changes}</ul></details>`;
}
function cameraButtons(action) {
  return `${button(action + ":left", "rotateLeft", "text-btn", "back")}${button(action + ":right", "rotateRight", "text-btn", "arrow")}
    ${button(action + ":in", "zoomIn")}${button(action + ":out", "zoomOut")}${button(action + ":reset", "cameraReset", "text-btn")}`;
}
function changeCamera(tool, val) {
  if (val === "left") tool?.rotate(-0.24, 0);
  if (val === "right") tool?.rotate(0.24, 0);
  if (val === "in") tool?.zoom(1.2);
  if (val === "out") tool?.zoom(1 / 1.2);
  if (val === "reset") tool?.reset();
}
function timelineView() {
  return `<button class="btn secondary" data-a="case-visual" aria-expanded="${timelineOpen}" aria-controls="caseViz">${t(timelineOpen ? "hideTimeline3d" : "timeline3d")}</button>
    <div id="caseViz" ${timelineOpen ? "" : "hidden"}>
    ${
      timelineOpen
        ? `<div class="case-viz network-viewport">
      <canvas id="caseCanvas" tabindex="0" role="img" aria-label="${t("networkKeyboard")}"></canvas>
      <div class="network-legend"><span class="network-customer">${t("customerRole")}</span><span class="network-recipient">${t("employeeRole")}</span></div></div>
      <div class="network-tools" role="group" aria-label="${t("networkCamera")}">${cameraButtons("case-camera")}</div>
      <p class="network-caption">${t("timelineHint")}</p>
      <label class="filter-field">${t("timelineEvent")}<select id="timelineEvent"></select></label>
      <p id="timelineEventInfo" aria-live="polite"></p>`
        : ""
    }</div>`;
}
function mountTimeline(record) {
  const log = record.log;
  const selection = { node: log.length - 1, edge: null };
  const entries = log.map((entry) => ({
    role:
      entry.actor?.role ??
      (decisionEvents.has(entry.event) ? "analyst" : "customer"),
    phase: [
      "release",
      "falseAlarm",
      "stop",
      "cancel",
      "dispute",
      "pay",
      "checkedPay",
      "advised",
      "inconclusive",
    ].includes(entry.event)
      ? 2
      : ["created", "edited", "reportSent"].includes(entry.event)
        ? 0
        : 1,
  }));
  const select = $("#timelineEvent");
  select.innerHTML = log
    .map((entry, index) =>
      opt(
        String(index),
        String(selection.node),
        index + 1 + ". " + t(entry.event),
      ),
    )
    .join("");
  function pick(index) {
    const entry = log[index];
    if (!entry) return;
    selection.node = index;
    select.value = String(index);
    $("#timelineEventInfo").textContent = [
      t(entry.event),
      date(entry.time),
      entry.actor?.name,
      entry.reason ? t(entry.reason) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    caseCanvas?.paint();
  }
  select.onchange = () => pick(Number(select.value));
  caseCanvas = N.attach(
    $("#caseCanvas"),
    N.timeline(entries),
    selection,
    (hit) => pick(hit.node),
  );
  if (!caseCanvas) {
    graphicsUnavailable = true;
    timelineOpen = false;
    $("#caseViz").hidden = true;
    $('[data-a="case-visual"]').hidden = true;
    return;
  }
  pick(selection.node);
}
function auditPanel(r) {
  const entries = r.log
    .slice()
    .reverse()
    .map(
      ({
        event,
        time,
        actor,
        reason,
        channel,
        before,
        after,
        warningLevel,
      }) => {
        const reportDecision = isReport(r) && event !== "reportSent";
        return `<li><strong>${t(reportDecision ? "messageReviewed" : event)}</strong>
      ${reason ? `<p>${reportDecision ? t(event) + " · " : ""}${t(reason)}</p>` : ""}
      ${channel ? `<p>${t(channel)}</p>` : ""}
      ${["medium", "high"].includes(warningLevel) ? `<p class="audit-warning">${t("warningShown")} · ${t(warningLevel)}</p>` : ""}
      <small>${date(time)}${actor?.name && typeof actor.name === "string" ? " · " + esc(actor.name) : ""}</small>
      ${before && after ? editSummary(before, after) : ""}</li>`;
      },
    )
    .join("");
  return `<section class="panel pad audit-panel"><h2>${t("audit")}</h2>${r.log.length > 1 && !compactNetwork.matches && !graphicsUnavailable ? timelineView() : ""}<ol class="timeline">${entries}</ol></section>`;
}
function recorded(r, meta = {}) {
  return {
    ...r,
    log: [
      ...r.log.slice(0, -1),
      {
        ...r.log.at(-1),
        actor: { id: accountId, name: profileName(accountId), role: profile },
        ...meta,
      },
    ],
  };
}
function notePanel(r) {
  const notes = Array.isArray(r.notes)
    ? r.notes.filter(
        (note) =>
          typeof note?.text === "string" &&
          typeof note.author === "string" &&
          Number.isFinite(note.time) &&
          Math.abs(note.time) < 8.64e15,
      )
    : [];
  return `<section class="panel pad case-notes"><h2>${t("caseNotes")}</h2>
    ${
      notes.length
        ? `<ol class="notes-list">${notes
            .slice()
            .reverse()
            .map(
              (note) =>
                `<li><p>${esc(note.text)}</p><small>${esc(note.author)} · ${date(note.time)}</small></li>`,
            )
            .join("")}</ol>`
        : `<p>${t("noNotes")}</p>`
    }
    <form id="caseNoteForm" novalidate>
      <label for="caseNote">${t("addNote")}</label>
      <textarea id="caseNote" rows="3" maxlength="400" aria-describedby="noteHelp noteError" required></textarea>
      <small id="noteHelp">${t("notesLocal")}</small><p id="noteError" class="entry-error" role="alert"></p>
      <button type="submit" class="btn secondary">${t("saveNote")}</button>
    </form></section>`;
}
function evidenceLimits(r) {
  const question = !active(r)
    ? "limitsClosed"
    : M.hasMismatch(r)
      ? "limitsMismatch"
      : M.verification(r)?.event === "answer"
        ? "limitsAttested"
        : "limitsMissing";
  return `<section class="panel pad evidence-limits"><h2>${t("sourceAndGaps")}</h2>
    <p>${t("transferSource")}</p><p>${t(question)}</p>
    <p class="evidence-caution">${t("evidenceCaution")}</p></section>`;
}
function detail() {
  const r = current(),
    analyst = page === "case",
    previous = analyst ? caseOrigin : "history";
  const title = analyst
    ? "caseTitle"
    : r.status === "pending"
      ? "preview"
      : "details";
  const tip =
    !analyst && M.assess(r).signals.length
      ? `<div class="notice advice">${icon("shield")}<span>${[...(r.context?.includes("screenSharing") ? ["screenAdvice"] : []), ...(r.codeRequested ? ["codeTip"] : []), ...(r.purpose === "safeAccount" ? ["pressureTip"] : !r.codeRequested ? ["tip"] : [])].map(t).join(" ")}</span></div>`
      : "";
  const receipt = `<section class="panel pad receipt">
    <div class="receipt-top">${avatar(r)}<div><strong>${M.recipients[r.recipient].name}</strong><small>${t("recipient")}</small></div><code>#${r.id}</code></div>
    <strong class="big-amount">${money(r.amount)}</strong>
    <dl>${pair("purpose", t(r.purpose))}${pair("date", date(r.time))}</dl>
  </section>`;
  const context = analyst
    ? observed(r)
    : `<details class="panel context-disclosure"><summary>${t("observed")}</summary>${observed(r)}</details>`;
  const audit = auditPanel(r);
  const response = verificationPanel(r);
  return `<button class="text-btn back" data-a="nav:${previous}">${icon("back", 16)}${t(previous)}</button>
    <div class="page-heading"><h1>${t(title)}</h1>${transferBadge(r)}</div>
    ${r.status === "pending" ? transferSteps(true) : ""}
    <div class="detail-grid ${analyst ? "analyst-detail" : ""}">
      <div class="stack">${receipt}${tip}${riskPanel(r, analyst)}${analyst ? context + evidenceLimits(r) + relatedTransfers(r) : response + actions(r, false)}</div>
      <div class="stack">${analyst ? analystBrief(r, M.assess(r).signals) + response + actions(r, true) : context + audit}</div>
      ${analyst ? `<div class="stack case-events">${audit}${notePanel(r)}</div>` : ""}
    </div>`;
}
function syncDraft() {
  const form = $("#transferForm");
  if (page !== "transfer" || !form) return;
  const data = new FormData(form);
  draft = {
    ...Object.fromEntries(data),
    context: data.getAll("context"),
    codeRequested: $("#codeRequested").checked,
  };
}
function update(r) {
  rows = [r, ...rows.filter((x) => x.id !== r.id)];
  persist();
}
function showProfileSettings() {
  const dialog = $("#dialog");
  dialog.setAttribute("aria-labelledby", "dialogTitle");
  dialog.removeAttribute("aria-describedby");
  dialog.onchange = null;
  dialog.onsubmit = null;
  dialog.innerHTML = `<form id="profileSettingsForm" novalidate>
    <h2 id="dialogTitle">${t("profileSettings")}</h2><p>${t("profileLocalHint")}</p>
    <p>${esc(W.choices(profile, accounts).find((item) => item.id === accountId)?.email ?? "")}</p>
    <label class="reason-label" for="renameProfile">${t("displayName")}</label>
    <input id="renameProfile" value="${esc(profileName(accountId))}" maxlength="40" autocomplete="off" aria-describedby="profileError" required>
    <p id="profileError" class="entry-error" role="alert"></p>
    <div class="action-row">${button("profile-close", "close")}<button type="submit" class="btn primary">${t("saveProfile")}</button></div>
  </form>`;
  dialog.showModal();
}
function clearDrafts() {
  V.clear();
  messageDraft = "";
  checkedMessage = null;
  messageHint = null;
  reportSummaryId = null;
  mode = "text";
  draft = {};
  draftScenario = "";
  editing = null;
  listState.history = { filter: "", search: "" };
  listState.analyst = { filter: "open", search: "" };
  listState.reports = { filter: "open", search: "" };
  historyKind = "all";
  decisionScope = decisionSearch = "";
  caseOrigin = "analyst";
  Object.assign(queueFilters, { risk: "", days: "", sort: "priority" });
  Object.assign(networkFilters, { risk: "", days: "", status: "" });
  Object.assign(networkSelection, { node: "", edge: null });
}
function leaveProfile() {
  saveProfile(null);
  clearDrafts();
  if (warning === "restrictedRecord") warning = "";
  returnPlace = null;
  page = "access";
  showEntry(null);
  announce("signedOut");
}
function accessSubmit() {
  let id;
  let field = "accountLogin";
  if (registering) {
    const name = W.displayName(nameDraft);
    let error = nameError(name, entryRole);
    const email = W.demoEmail(emailDraft);
    field = error ? "displayName" : "demoEmail";
    error ||= !email
      ? "invalidDemoEmail"
      : W.roles.some((role) =>
            W.choices(role, accounts).some(
              (account) => account.email === email,
            ),
          )
        ? "emailUsed"
        : "";
    entryError = error;
    if (!entryError) {
      id =
        "demo-" +
        Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
      saveAccount({ id, role: entryRole, name, email });
    }
  } else {
    id = W.accountByLogin(entryRole, loginDraft, accounts)?.id;
    entryError = !loginDraft.trim()
      ? "loginRequired"
      : !id
        ? "accountUnknown"
        : "";
  }
  const selectedActor = !entryError && W.signIn(entryRole, id, accounts);
  if (!selectedActor) {
    entryError ||= "chooseProfileError";
    $("#accessError").textContent = t(entryError);
    const input = $("#" + field);
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }
  const created = registering;
  const pending = resume;
  clearDrafts();
  saveProfile(selectedActor);
  resume = returnPlace = null;
  entryError = "";
  openPage(pending?.page ?? home(), pending?.id ?? null, pending ?? {});
  if (created) {
    $("#main").insertAdjacentHTML(
      "afterbegin",
      `<p class="notice account-created">${icon("check", 17)}${t("accountCreated")}</p>`,
    );
  }
  announce(created ? "accountCreated" : "signedIn");
}
function confirmAction(
  title,
  message,
  label,
  done,
  reasons = [],
  verification = null,
) {
  const dialog = $("#dialog");
  dialog.innerHTML =
    '<form method="dialog" novalidate><h2 id="dialogTitle">' +
    t(title) +
    "</h2><p>" +
    esc(message) +
    "</p>" +
    (reasons.length
      ? `<label class="reason-label">${t(title === "mismatchTitle" ? "mismatchField" : "decisionReason")}<select name="reason" aria-describedby="reason-error" required>${opt("", "", t("choose"))}${reasons.map((k) => opt(k, null, t(k))).join("")}</select><small id="reason-error" role="alert"></small></label>`
      : "") +
    (verification
      ? `<dl class="verify-summary">${pair("recipient", M.recipients[verification.recipient].name)}${pair("amount", money(verification.amount))}</dl>
      <label class="reason-label">${t("verifyChannel")}<select name="channel" required>${opt("", "", t("choose"))}${M.channels.map((k) => opt(k, null, t(k))).join("")}</select></label>
      <label class="attest"><input id="attest" type="checkbox">${t("checkedFields")}</label>`
      : "") +
    '<div class="action-row"><button value="no" formnovalidate class="btn secondary" autofocus>' +
    t("stay") +
    '</button><button value="yes" class="btn primary" ' +
    (verification ? "disabled" : "") +
    ">" +
    t(label) +
    "</button></div></form>";
  dialog.setAttribute("aria-labelledby", "dialogTitle");
  dialog.removeAttribute("aria-describedby");
  dialog.returnValue = "";
  const reasonSelect = dialog.querySelector("[name=reason]");
  if (reasonSelect)
    reasonSelect.onchange = () => {
      reasonSelect.removeAttribute("aria-invalid");
      $("#reason-error").textContent = "";
    };
  const channel = dialog.querySelector("[name=channel]");
  const checked = dialog.querySelector("#attest");
  const verified = () =>
    M.channels.includes(channel?.value) && checked?.checked;
  dialog.onchange = verification
    ? () => {
        dialog.querySelector("[value=yes]").disabled = !verified();
      }
    : null;
  dialog.onsubmit = (e) => {
    e.preventDefault();
    if (
      e.submitter?.value === "yes" &&
      reasonSelect &&
      !reasons.includes(reasonSelect.value)
    ) {
      reasonSelect.setAttribute("aria-invalid", "true");
      $("#reason-error").textContent = t(
        title === "mismatchTitle" ? "chooseMismatch" : "chooseReason",
      );
      reasonSelect.focus();
      return;
    }
    if (e.submitter?.value === "yes" && verification && !verified()) return;
    dialog.close();
    if (e.submitter?.value === "yes")
      done(verification ? channel.value : reasonSelect?.value);
  };
  dialog.showModal();
}
function showMessageResult(example) {
  openPage("checkMessage", null, {
    prepare: () => {
      if (example !== undefined) {
        messageDraft = example;
        mode = "text";
      }
      checkedMessage = messageDraft.trim();
      messageHint = useSimilarity ? S.similarityHint(checkedMessage) : null;
      reportSummaryId = null;
      V.stop();
    },
    after: () => $("#messageEvidenceHeading").focus(),
  });
}
document.addEventListener("submit", (e) => {
  if (e.target.id === "rulesForm" && page === "rules") {
    e.preventDefault();
    const first = $("#sandboxLow"),
      second = $("#sandboxHigh");
    if (
      !first.validity.valid ||
      !second.validity.valid ||
      Number(first.value) >= Number(second.value)
    ) {
      $("#ruleError").textContent = t("sandboxError");
      second.focus();
      return;
    }
    sandboxLow = Number(first.value);
    sandboxHigh = Number(second.value);
    ruleExample = $("#ruleExample").value;
    render();
    $("#ruleResult").setAttribute("tabindex", "-1");
    $("#ruleResult").focus();
    return;
  }
  if (e.target.id === "accessForm" && page === "access" && entryRole) {
    e.preventDefault();
    accessSubmit();
    return;
  }
  if (
    e.target.id === "caseNoteForm" &&
    profile === "analyst" &&
    ["case", "message-case"].includes(page)
  ) {
    e.preventDefault();
    const input = $("#caseNote");
    const value = input.value.trim();
    const r = current();
    if (!value || value.length > 400) {
      $("#noteError").textContent = t("noteInvalid");
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    const changed = {
      ...r,
      notes: [
        ...(Array.isArray(r.notes) ? r.notes : []),
        {
          text: value,
          author: profileName(accountId),
          actorId: accountId,
          time: Date.now(),
        },
      ],
    };
    if (isReport(r)) {
      reports = reports.map((report) =>
        report.id === r.id ? changed : report,
      );
      persistReports();
    } else update(changed);
    render();
    $("#caseNote").focus();
    announce("noteSaved");
    return;
  }
  if (e.target.id === "profileSettingsForm" && profile && page !== "access") {
    e.preventDefault();
    const input = $("#renameProfile");
    const name = W.displayName(input.value);
    const error = nameError(name, profile, accountId);
    if (error) {
      $("#profileError").textContent = t(error);
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    saveAccount({ ...actor(), name });
    syncDraft();
    $("#dialog").close();
    render();
    $("#profileButton").focus();
    announce("profileUpdated");
    return;
  }
  if (page === "access" || profile !== "customer") return;
  if (e.target.id === "messageForm") {
    e.preventDefault();
    messageDraft = $("#messageInput").value;
    if (!S.validText(messageDraft)) {
      $("#messageError").textContent = t("messageInvalid");
      $("#messageInput").setAttribute("aria-invalid", "true");
      $("#messageInput").focus();
      return;
    }
    showMessageResult();
    return;
  }
  if (e.target.id !== "transferForm") return;
  e.preventDefault();
  syncDraft();
  const raw = String(draft.amount).trim();
  const validFormat = /^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)$/.test(raw);
  const d = { ...draft, amount: Number(raw.replace(/[ \u00a0\u202f]/g, "")) };
  const amountOK = validFormat && d.amount >= 1 && d.amount <= 1000000;
  const missing = ["recipient", "purpose", "activity"].find((k) => !d[k]);
  const invalid = missing || (!amountOK ? "amount" : null);
  if (invalid || !M.valid(d)) {
    const id = invalid || "recipient";
    $("#errors").textContent = t(id === "amount" ? "badAmount" : "missing");
    $("#" + id).setAttribute("aria-invalid", "true");
    $("#" + id).focus();
    return;
  }
  const existing =
    editing &&
    rows.find((r) => r.id === editing && myRecord(r) && r.status === "pending");
  const now = Date.now(),
    r = existing
      ? M.edit(existing, d, now)
      : M.make(
          rows.reduce((max, r) => Math.max(max, r.id), 1048) + 1,
          { ...d, owner: accountId },
          now,
        );
  if (existing !== r) update(recorded(r, { warningLevel: M.assess(r).level }));
  editing = null;
  openPage("detail", r.id);
});
document.addEventListener("input", (e) => {
  if (e.target.id === "decisionSearch" && page === "decisions") {
    decisionSearch = e.target.value;
    $("#decisionResults").innerHTML = decisionsTable();
  }
  if (e.target.id === "caseNote") {
    $("#noteError").textContent = "";
    e.target.removeAttribute("aria-invalid");
  }
  if (["displayName", "demoEmail", "accountLogin"].includes(e.target.id)) {
    if (e.target.id === "displayName") nameDraft = e.target.value;
    if (e.target.id === "demoEmail") emailDraft = e.target.value;
    if (e.target.id === "accountLogin") loginDraft = e.target.value;
    entryError = "";
    for (const field of $("#accessForm").querySelectorAll("[aria-invalid]"))
      field.removeAttribute("aria-invalid");
    $("#accessError").textContent = "";
  }
  if (e.target.id === "renameProfile") {
    e.target.removeAttribute("aria-invalid");
    $("#profileError").textContent = "";
  }
  if (e.target.id === "messageInput") {
    messageDraft = e.target.value;
    e.target.removeAttribute("aria-invalid");
    $("#messageError").textContent = "";
    $("#messageCount").textContent = messageDraft.length + "/" + S.maxLength;
  }
  if (e.target.id === "search") {
    search = listState[page].search = e.target.value;
    updateList();
  }
  if (e.target.closest("#transferForm")) {
    e.target.removeAttribute("aria-invalid");
    $("#errors").textContent = "";
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "decisionScope" && page === "decisions") {
    decisionScope = e.target.value;
    $("#decisionResults").innerHTML = decisionsTable();
  }
  const queueKey = { queueRisk: "risk", queueDays: "days", queueSort: "sort" }[
    e.target.id
  ];
  if (staffQueue() && queueKey) {
    queueFilters[queueKey] = e.target.value;
    updateList();
  }
  const networkKey = {
    networkStatus: "status",
    networkRisk: "risk",
    networkDays: "days",
  }[e.target.id];
  if (page === "network" && networkKey) {
    networkFilters[networkKey] = e.target.value;
    mountNetwork();
  }
  if (page === "network" && e.target.id === "networkNode") {
    networkSelection.node = e.target.value;
    updateNetworkSelection(networkRecords());
    networkCanvas?.paint();
  }
  if (e.target.id === "recipient")
    $("#recipientCheck").textContent = recipientHint(e.target.value);

  if (e.target.id === "similarityOption") useSimilarity = e.target.checked;
  if (e.target.id === "voiceFile") V.load(e.target.files[0]);

  if (e.target.id === "statusFilter") {
    filter = listState[page].filter = e.target.value;
    updateList();
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".top-menu")) closeTopMenus();
  const b = e.target.closest("[data-a]");
  if (!b) return;
  const [a, val] = b.dataset.a.split(":");
  if (a === "top-menu") {
    topMenu(val, $("#" + val + "Menu").hidden);
    return;
  }
  if (a === "theme" && W.themes.includes(val)) {
    theme = val;
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      announce("storeFail");
    }
    applyTheme();
    $("#themeButton").innerHTML = themeIcon();
    const options = $("#themeMenu").querySelectorAll("[data-a]");
    for (const option of options) {
      const selected = option.dataset.a === "theme:" + theme;
      option.setAttribute("aria-pressed", String(selected));
      option.querySelector("svg:last-child:not(:first-child)")?.remove();
      if (selected) option.insertAdjacentHTML("beforeend", icon("check", 16));
    }
    topMenu("theme", false, true);
    return;
  }
  if (a === "lang" && ["ru", "kk"].includes(val)) {
    syncDraft();
    lang = val;
    try {
      localStorage.setItem(languageKey, lang);
    } catch {
      warning = "storeFail";
    }
    render();
    $('[data-a="lang:' + val + '"]').focus();
    return;
  }
  if (page === "access") {
    if (a === "entry" && W.roles.includes(val)) showEntry(val);
    if (a === "entry-register" && entryRole && !resume) {
      registering = !registering;
      entryError = "";
      focusPage();
    }
    if (a === "entry-back") {
      if (returnPlace && (resume || !entryRole)) {
        const previous = returnPlace;
        returnPlace = resume = null;
        openPage(previous.page, previous.id);
      } else showEntry(null);
    }
    return;
  }
  if (!profile) return;
  if (a === "sign-in") {
    topMenu("profile", $("#profileMenu").hidden);
    return;
  }
  if (a === "profile-settings") {
    topMenu("profile", false, true);
    showProfileSettings();
    return;
  }
  if (a === "profile-close") {
    $("#dialog").close();
    return;
  }
  if (a === "other-role") {
    showEntry(null);
    return;
  }
  if (a === "sign-out") {
    leaveProfile();
    return;
  }
  if (a === "evidence") {
    const mark = $(
      '.message-quote mark[data-signals~="' + CSS.escape(val) + '"]',
    );
    if (mark) {
      mark.focus({ preventScroll: true });
      mark.scrollIntoView({ block: "center" });
    }
    return;
  }
  if (a === "demo-message") {
    showMessageResult(messageExamples.bank[lang === "ru" ? 0 : 1]);
    return;
  }
  if (a === "mode") {
    if (mode === "voice" && val === "text") {
      if (V.state() === "voiceWaiting") V.clear();
      else V.stop();
    }
    mode = val;
    render();
    $('[data-a="mode:' + val + '"]').focus();
    return;
  }
  if (a === "voice-record") {
    V.record();
    return;
  }
  if (a === "voice-stop") {
    V.stop();
    return;
  }
  if (a === "voice-remove") {
    V.clear();
    $("#voiceTools").innerHTML = voiceControls();
    $('[data-a="voice-record"]').focus();
    return;
  }
  if (a === "message-edit") {
    checkedMessage = null;
    reportSummaryId = null;
    render();
    $("#messageInput").focus();
    return;
  }
  if (
    a === "save-summary" &&
    checkedMessage !== null &&
    reportSummaryId === null
  ) {
    const id = summaries.reduce((max, r) => Math.max(max, r.id), 100) + 1;
    summaries = [
      {
        ...S.summary(id, checkedMessage, messageHint, Date.now()),
        owner: accountId,
      },
      ...summaries,
    ];
    reportSummaryId = id;
    persistSummaries();
    render();
    $('[data-a="message-summary:' + id + '"]').focus();
    announce("summarySaved");
    return;
  }
  if (a === "message-summary") {
    openPage(a, Number(val));
    return;
  }
  if (a === "message-transfer" && checkedMessage !== null) {
    const signals = S.inspect(checkedMessage).map((s) => s.key);
    const signalToContext = {
      urgency: "urgentTransfer",
      bankImpersonation: "bankClaim",
      secrecySignal: "secretTransfer",
      moneyRequest: "remoteRequest",
    };
    openTransfer(
      {
        recipient: "",
        amount: "",
        activity: "normal",
        purpose: signals.includes("safeAccountSignal") ? "safeAccount" : "",
        codeRequested: signals.includes("askCodeSignal"),
        context: signals.map((k) => signalToContext[k]).filter(Boolean),
      },
      "fromMessage",
    );
    return;
  }
  if (a === "menu") {
    syncDraft();
    menu = !menu;
    render();
    $(menu ? ".sidebar .nav-item" : ".menu-icon").focus();
    return;
  }
  if (a === "nav") {
    val === "transfer" ? start() : openPage(val);
    return;
  }
  if (profile === "analyst" && a === "clear-queue" && staffQueue()) {
    Object.assign(queueFilters, { risk: "", days: "", sort: "priority" });
    filter = listState[page].filter = "open";
    search = listState[page].search = "";
    render();
    $('[data-a="clear-queue"]').focus();
    return;
  }
  if (profile === "analyst" && a === "network-recipient" && page === "case") {
    Object.assign(networkFilters, { risk: "", days: "", status: "" });
    networkSelection.node = "recipient:" + val;
    networkSelection.edge = current().id;
    openPage("network");
    return;
  }
  if (profile === "analyst" && page === "network") {
    if (a === "network-mode" && ["space", "list"].includes(val)) {
      networkMode = val;
      render();
      $('[data-a="network-mode:' + val + '"]').focus();
      return;
    }
    if (a === "clear-network") {
      Object.assign(networkFilters, { risk: "", days: "", status: "" });
      Object.assign(networkSelection, { node: "", edge: null });
      render();
      $('[data-a="clear-network"]').focus();
      return;
    }
    if (a === "network-edge") {
      selectNetwork(undefined, Number(val), true);
      return;
    }
    if (a === "camera") {
      changeCamera(networkCanvas, val);
      return;
    }
  }
  if (
    a === "case-visual" &&
    current()?.log.length > 1 &&
    !graphicsUnavailable
  ) {
    timelineOpen = !timelineOpen;
    render();
    $('[data-a="case-visual"]')?.focus();
    return;
  }
  if (a === "case-camera") {
    changeCamera(caseCanvas, val);
    return;
  }
  if (a === "help-reports" && page === "help") {
    historyKind = "reports";
    listState.history = { filter: "", search: "" };
    openPage("history");
    return;
  }
  if (a === "history-mode" && page === "history") {
    historyKind = val;
    filter = listState.history.filter = "";
    render();
    $('[data-a="history-mode:' + val + '"]').focus();
    return;
  }
  if (a === "queue-current") {
    caseOrigin = page;
    const record = filtered()[0];
    if (record) openPage(isReport(record) ? "message-case" : "case", record.id);
    return;
  }
  if (a === "queue") {
    filter = listState[page].filter = filter === val ? "open" : val;
    updateList();
    return;
  }
  if (a === "scenario") {
    start(val);
    return;
  }
  if (a === "detail" || a === "case") {
    if (a === "case" && ["analyst", "network", "decisions"].includes(page))
      caseOrigin = page;
    openPage(a, Number(val));
    return;
  }
  if (a === "edit" && page === "detail" && current()?.status === "pending") {
    start("", current());
    return;
  }
  if (a === "message-sample") {
    openPage("checkMessage", null, {
      prepare: () => {
        if (page !== "checkMessage") mode = "text";
        messageDraft = messageExamples[val][lang === "ru" ? 0 : 1];
        checkedMessage = null;
      },
      after: () => $("#messageInput").focus(),
    });
    return;
  }
  if (a === "message-new") {
    openPage("checkMessage", null, {
      prepare: () => {
        messageDraft = "";
        checkedMessage = null;
        messageHint = null;
        reportSummaryId = null;
        mode = "text";
        V.clear();
      },
    });
    return;
  }
  if (a === "message-detail" || a === "message-case") {
    if (
      a === "message-case" &&
      ["analyst", "reports", "decisions"].includes(page)
    )
      caseOrigin = page;
    openPage(a, Number(val));
    return;
  }
  if (a === "report-message" && checkedMessage !== null) {
    const evidence = checkedMessage;
    confirmAction("reportTitle", t("reportConfirm"), "reportMessage", () => {
      const id = reports.reduce((max, r) => Math.max(max, r.id), 100) + 1;
      reports = [
        recorded({ ...S.make(id, evidence, Date.now()), owner: accountId }),
        ...reports,
      ];
      persistReports();
      messageDraft = "";
      checkedMessage = null;
      openPage("message-detail", id);
      announce("submitted");
    });
    return;
  }
  if (
    a === "message-outcome" &&
    page === "message-case" &&
    profile === "analyst" &&
    Object.hasOwn(S.decisions, val)
  ) {
    const report = current();
    if (!report || report.status !== "submitted") return;
    confirmAction(
      "confirmTitle",
      t("reportDecisionText"),
      "commit",
      (reason) => {
        const updated = recorded(S.resolve(report, val, reason, Date.now()));
        reports = reports.map((r) => (r.id === updated.id ? updated : r));
        persistReports();
        openPage("message-case", updated.id);
        $(".page-heading .badge")?.classList.add("status-updated");
        announce(val);
      },
      S.decisions[val],
    );
    return;
  }
  if (a === "reset" && profile === "customer") {
    confirmAction("resetTitle", t("resetDesc"), "confirmReset", () => {
      rows = [
        ...rows.filter((r) => !myRecord(r)),
        ...(accountId === W.starter ? M.seeds() : []),
      ];
      reports = reports.filter((r) => !myRecord(r));
      summaries = summaries.filter((r) => !myRecord(r));
      reportSummaryId = null;
      V.clear();
      messageDraft = "";
      checkedMessage = null;
      warning = "";
      listState.history = { filter: "", search: "" };
      listState.analyst = { filter: "open", search: "" };
      persist();
      persistReports();
      persistSummaries();
      openPage("overview");
      announce("resetDone");
    });
    return;
  }
  if (a === "correct" && page === "detail" && M.hasMismatch(current())) {
    const original = current();
    const field = M.verification(original).reason;
    confirmAction("correctTitle", t("correctDesc"), "correctBtn", () => {
      update(recorded(M.transition(original, "cancel")));
      openTransfer(
        {
          recipient: field === "wrongAmount" ? original.recipient : "",
          amount: field === "wrongRecipient" ? original.amount : "",
          purpose: original.purpose,
          activity: original.activity,
          codeRequested: original.codeRequested,
          context: original.context,
        },
        "correctionForm",
      );
      announce("correctReady");
    });
    return;
  }
  if (a === "act" && ["detail", "case"].includes(page)) {
    const r = current();
    const events =
      page === "case"
        ? ["request", "keep", "release", "falseAlarm", "stop"]
        : [
            "pay",
            "checkedPay",
            "hold",
            "cancel",
            "answer",
            "deferVerification",
            "dispute",
            "mismatch",
          ];
    if (!events.includes(val)) return;
    const commit = (reason) => {
      const next = recorded(M.transition(r, val, Date.now(), reason));
      update(next);
      openPage(page, next.id);
      $(".page-heading .badge")?.classList.add("status-updated");
      announce(next.status);
    };
    if (["checkedPay", "answer"].includes(val))
      confirmAction(
        "verifyTitle",
        t("verifyIntro"),
        val === "answer" ? "replyBtn" : "confirmPay",
        commit,
        [],
        r,
      );
    else if (["request", "keep"].includes(val))
      confirmAction(
        val === "request" ? "requestReviewTitle" : "keepReviewTitle",
        t(val === "request" ? "requestReviewBody" : "keepReviewBody"),
        val === "request" ? "askBtn" : "keepBtn",
        commit,
        M.reasonsFor(val, r),
      );
    else if (val === "stop")
      confirmAction(
        "stopTitle",
        t("stopDesc"),
        "stopBtn",
        commit,
        M.reasonsFor(val, r),
      );
    else if (val === "mismatch")
      confirmAction(
        "mismatchTitle",
        t("mismatchDesc"),
        "sendMismatch",
        commit,
        M.reasonsFor(val, r),
      );
    else if (val === "dispute")
      confirmAction("disputeTitle", t("disputeDesc"), "stopBtn", commit);
    else if (val === "cancel")
      confirmAction(
        "cancelTitle",
        M.recipients[r.recipient].name + " · " + money(r.amount),
        "cancelBtn",
        commit,
      );
    else if (val === "release" || val === "falseAlarm")
      confirmAction(
        "confirmTitle",
        t(val === "release" ? "approvedDesc" : "falseDesc"),
        "commit",
        commit,
        M.reasonsFor(val, r),
      );
    else commit();
  }
});
document.addEventListener("focusin", (e) => {
  if (!e.target.closest(".top-menu")) closeTopMenus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#dialog").open) closeTopMenus(true);
  if (menu && !$("#dialog").open && e.key === "Tab") {
    const items = $("#side").querySelectorAll("button");
    const first = items[0],
      last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  if (e.key === "Escape" && menu && !$("#dialog").open) {
    menu = false;
    syncDraft();
    render();
    $(".menu-icon").focus();
  }
});
window
  .matchMedia("(max-width:780px)")
  .addEventListener("change", ({ matches }) => {
    if (menu && !matches) {
      syncDraft();
      menu = false;
      render();
    }
  });
compactNetwork.addEventListener("change", ({ matches }) => {
  if (matches && timelineOpen) {
    timelineOpen = false;
    render();
  }
  if (matches && networkMode === "space") {
    networkMode = "list";
    if (page === "network") render();
  }
});
V.onChange(() => {
  const slot = $("#voiceTools");
  if (slot) {
    const focused = slot.contains(document.activeElement);
    slot.innerHTML = voiceControls();
    if (focused) slot.querySelector("button,input")?.focus();
  }
});
document.addEventListener(
  "error",
  (e) => {
    if (e.target.id === "voicePlayback")
      $("#audioError").textContent = t("audioBroken");
  },
  true,
);
window.addEventListener("pagehide", V.clear);
restoreProfilePlace();
render();
