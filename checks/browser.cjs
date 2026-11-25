// Optional developer check. Serve the checkout, then run with Playwright and Chromium available.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const { readFileSync, mkdtempSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { tmpdir } = require("node:os");
const { resolve } = require("node:path");
const base = process.env.DEMO_URL || "http://127.0.0.1:4173";
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_BIN || undefined,
    args: ["--no-sandbox", "--use-fake-device-for-media-stream"],
  });
  try {
    const context = await b.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const p = await context.newPage();
    p.setDefaultTimeout(3500);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const control = (k) => p.locator('[data-a="' + k + '"]:visible').first();
    const click = (k) => control(k).click();
    const signIn = () => p.locator("#accessForm button[type=submit]").click();
    const role = () =>
      p.evaluate(
        () => JSON.parse(localStorage.getItem("qalqan.profile.v1"))?.role,
      );
    const switchWorkspace = async (target) => {
      if ((await role()) === target) return;
      if (await p.locator(".sidebar.shown").count())
        await p.keyboard.press("Escape");
      await click("sign-in");
      await click("other-role");
      await click("entry:" + target);
      await signIn();
      assert.equal(await role(), target);
    };
    const act = async (k) => {
      if (k.startsWith("nav:") || k === "reset") {
        const target = ["nav:analyst", "nav:network"].includes(k)
          ? "analyst"
          : "customer";
        await switchWorkspace(target);
        if (
          !(await control(k).isVisible()) &&
          (await p.locator(".menu-icon").isVisible())
        )
          await click("menu");
      }
      await click(k);
      if (["act:request", "act:keep"].includes(k)) {
        await p.selectOption("dialog select", { index: 1 });
        await yes();
      }
      if (
        /^(case|detail|message-case|message-detail):/.test(k) &&
        (await p.locator("#accessForm").isVisible())
      )
        await signIn();
    };
    const submit = () => p.locator("#transferForm button").click();
    const latest = () =>
      p.evaluate(
        () => JSON.parse(localStorage.getItem("qalqan.records.v1"))[0],
      );
    const yes = () => p.locator("dialog button[value=yes]").click();
    const desk = () => act("nav:overview");
    const scenario = async (k) => {
      await desk();
      await act("scenario:" + k);
      await submit();
    };
    let scanned = 0;
    const a11y = async (name) => {
      if (process.env.AXE_JS) {
        await p.addScriptTag({ path: process.env.AXE_JS });
        const result = await p.evaluate(async () =>
          (
            await axe.run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            })
          ).violations.map((v) => [v.id, v.nodes.map((n) => n.target)]),
        );
        assert.deepEqual(result, [], name + " " + JSON.stringify(result));
        scanned += 1;
      }
    };
    await p.goto(base);
    await p.keyboard.press("Tab");
    assert.equal(
      await p.locator(".skip").evaluate((e) => e === document.activeElement),
      true,
    );
    await p.evaluate(() => document.fonts.ready);
    const profileKey = "qalqan.profile.v1";
    const originalRecords = await p.evaluate(() =>
      localStorage.getItem("qalqan.records.v1"),
    );
    const theme = {
      inputValue: () =>
        p
          .locator('#themeMenu [aria-pressed="true"]')
          .getAttribute("data-a")
          .then((value) => value.split(":")[1]),
      selectOption: async (value) => {
        await click("top-menu:theme");
        await click("theme:" + value);
      },
    };
    const palette = () => p.locator("html").getAttribute("data-theme");
    const system = async (colorScheme) => {
      await p.emulateMedia({ colorScheme });
      await p.locator('html[data-theme="' + colorScheme + '"]').waitFor();
    };
    const pageOverflow = () =>
      p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(await role(), undefined);
    assert.equal(await p.locator(".sidebar").count(), 0);
    assert.equal(await theme.inputValue(), "light");
    await p.emulateMedia({ colorScheme: "dark" });
    assert.equal(await palette(), "light");
    await a11y("entry light RU");
    assert.equal(
      await p
        .locator("html")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(255, 255, 255)",
    );
    await theme.selectOption("system");
    await system("dark");
    await theme.selectOption("light");
    await p.reload();
    assert.equal(await palette(), "light");
    await theme.selectOption("dark");
    await p.emulateMedia({ colorScheme: "light" });
    assert.equal(await palette(), "dark");
    await p.reload();
    assert.equal(await theme.inputValue(), "dark");
    await theme.selectOption("system");
    assert.equal(await palette(), "light");
    await system("dark");
    const emblem = await p.locator(".brand img").getAttribute("src");
    for (const [lang, width, appearance] of [
      ["ru", 1440, "light"],
      ["kk", 360, "dark"],
    ]) {
      await p.setViewportSize({ width, height: 850 });
      await act("lang:" + lang);
      await theme.selectOption(appearance);
      assert.ok(!(await pageOverflow()));
      await p.keyboard.press("Tab");
      await p.locator('[data-a="entry:customer"]').focus();
      assert.equal(
        await p
          .locator('[data-a="entry:customer"]')
          .evaluate((el) => getComputedStyle(el).outlineStyle),
        "solid",
      );
      await p.keyboard.press("Enter");
      assert.equal(await p.locator('input[type="password"]').count(), 0);
      await act("entry-register");
      await signIn();
      assert.ok(await p.locator("#accessError").textContent());
      assert.equal(
        await p.locator("#displayName").getAttribute("aria-invalid"),
        "true",
      );
      await a11y("register form " + lang);
      const name = lang === "ru" ? "Айша Демо" : "Дана Сынақ";
      const email = lang + "@qalqan.example";
      await p.fill("#displayName", name);
      await p.fill("#demoEmail", "outside@example.org");
      await signIn();
      assert.equal(
        await p.locator("#demoEmail").getAttribute("aria-invalid"),
        "true",
      );
      await p.fill("#demoEmail", email);
      await signIn();
      const newId = await p.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)).id,
        profileKey,
      );
      assert.match(newId, /^demo-/);
      assert.ok(await p.locator(".account-created").isVisible());
      assert.match(
        await p.locator("#profileButton").getAttribute("aria-label"),
        new RegExp(name),
      );
      await p.reload();
      assert.match(
        await p.locator("#profileButton").getAttribute("aria-label"),
        new RegExp(name),
      );
      assert.equal(await p.locator(".latest tbody tr").count(), 0);
      await act("nav:history");
      assert.ok(await p.locator(".empty").isVisible());
      await scenario("ordinary");
      await act("act:pay");
      assert.equal((await latest()).owner, newId);
      await act("sign-in");
      await a11y("signed-in profile " + lang);
      await p.keyboard.press("Escape");
      assert.ok(
        await p
          .locator('[data-a="sign-in"]')
          .evaluate((el) => el === document.activeElement),
      );
      await act("sign-in");
      await act("sign-out");
      assert.equal(await role(), undefined);
      await act("entry:customer");
      await act("entry-register");
      await p.fill("#displayName", name);
      await signIn();
      assert.ok(await p.locator("#accessError").textContent());
      await act("entry-register");
      await p.fill("#accountLogin", email);
      await signIn();
      assert.equal(await p.locator(".latest tbody tr").count(), 1);
      await act("sign-in");
      await act("profile-settings");
      await a11y("profile settings " + lang);
      const renamed = lang === "ru" ? "Айша Учебная" : "Дана Жаттығу";
      await p.fill("#renameProfile", renamed);
      await p.locator("#profileSettingsForm button[type=submit]").click();
      await p.reload();
      assert.ok(
        (await p.locator("#profileButton").getAttribute("aria-label")).includes(
          renamed,
        ),
      );
      const own = (await latest()).id;
      await switchWorkspace("analyst");
      assert.equal(await p.locator('[data-a^="case:' + own + '"]').count(), 0);
      assert.equal(
        await p
          .locator(
            '[data-a="nav:transfer"], [data-a="nav:history"], [data-a="reset"]',
          )
          .count(),
        0,
      );
      await a11y("queue " + lang + " " + appearance);
      await p.reload();
      assert.equal(await role(), "analyst");
      await act("case:1047");
      assert.equal(await p.locator(".receipt code").innerText(), "#1047");
      assert.ok(await p.locator(".analyst-brief").isVisible());
      await a11y("analyst brief " + lang);
      await p.reload();
      assert.ok(await p.locator(".analyst-detail").isVisible());
      await click("detail:1047");
      assert.match(await p.locator(".entry-record").innerText(), /#1047/);
      await click("entry-back");
      assert.ok(await p.locator(".analyst-detail").isVisible());
      await click("detail:1047");
      await p.fill("#accountLogin", email);
      await signIn();
      assert.equal(await p.locator(".receipt").count(), 0);
      assert.ok(await p.locator("main .notice").isVisible());
      await act("nav:transfer");
      await p.fill("#amount", "12345");
      await act("sign-in");
      await act("other-role");
      await act("entry-back");
      assert.equal(await p.inputValue("#amount"), "12345");
      await desk();
      await act("demo-message");
      await act("report-message");
      await yes();
      const report = await p.evaluate(
        () => JSON.parse(localStorage.getItem("qalqan.reports.v1"))[0],
      );
      assert.equal(report.owner, newId);
      await act("message-case:" + report.id);
      await act("message-outcome:advised");
      await p.selectOption("dialog select", "patternConcern");
      await yes();
      await click("message-detail:" + report.id);
      assert.equal(await p.inputValue("#accountLogin"), email);
      await signIn();
      assert.equal(await p.locator(".page-heading .advised").count(), 1);
      await act("reset");
      await yes();
      assert.equal(await p.locator(".latest tbody tr").count(), 0);
      await act("sign-in");
      await act("sign-out");
      assert.equal(await role(), undefined);
    }
    const separate = await p.context().newPage();
    await separate.goto(base);
    assert.equal(
      await separate.evaluate((k) => localStorage.getItem(k), profileKey),
      null,
    );
    await separate.close();
    assert.equal(
      await p.evaluate(
        (initial) =>
          JSON.parse(initial).every((r) =>
            JSON.parse(localStorage.getItem("qalqan.records.v1")).some(
              (x) => JSON.stringify(x) === JSON.stringify(r),
            ),
          ),
        originalRecords,
      ),
      true,
    );
    await act("lang:ru");
    await p.setViewportSize({ width: 1440, height: 960 });
    await act("entry:customer");
    await signIn();
    await a11y("customer overview dark RU");

    await act("demo-message");
    assert.equal(await p.locator("mark").count(), 7);
    await p.locator('[data-a="evidence:askCodeSignal"]').focus();
    await p.keyboard.press("Enter");
    assert.equal(
      await p.evaluate(() => document.activeElement.dataset.signals),
      "askCodeSignal",
    );
    await act("lang:kk");
    assert.equal(await p.locator(".brand img").getAttribute("src"), emblem);
    await desk();
    await act("demo-message");
    assert.equal(await p.locator("mark").count(), 7);
    await act("message-edit");
    await act("message-sample:suspicious");
    await p.locator("#messageForm button").click();
    await act("evidence:safeAccountSignal");
    assert.match(
      await p.evaluate(() => document.activeElement.dataset.signals),
      /safeAccountSignal/,
    );
    await act("lang:ru");
    await act("nav:transfer");
    await submit();
    assert.match(await p.locator("#errors").innerText(), /получателя/);
    await p.selectOption("#recipient", "dana");
    assert.match(
      await p.locator("#recipientCheck").textContent(),
      /Первый перевод/,
    );
    await p.selectOption("#recipient", "ali");
    assert.match(
      await p.locator("#recipientCheck").textContent(),
      /Знакомый получатель/,
    );
    await p.selectOption("#purpose", "family");
    for (const v of ["", "0", "-4", "1.5", "1000001", "xyz"]) {
      await p.fill("#amount", v);
      await submit();
      assert.match(await p.locator("#errors").innerText(), /1 000 000/);
    }
    await p.fill("#amount", "12 000");
    await act("lang:kk");
    assert.equal(await p.inputValue("#amount"), "12 000");
    await a11y("form kk");
    await act("lang:ru");
    await submit();
    await act("act:pay");
    assert.equal((await latest()).status, "completed");
    await scenario("ambiguous");
    await act("act:checkedPay");
    await a11y("verify dialog ru");
    const confirmButton = () => p.locator("dialog button[value=yes]");
    assert.ok(await confirmButton().isDisabled());
    await p.selectOption("dialog select", "knownNumber");
    assert.ok(await confirmButton().isDisabled());
    await p.check("#attest");
    await yes();
    assert.equal((await latest()).log.at(-1).event, "checkedPay");
    await scenario("suspicious");
    assert.equal(await p.locator(".score strong").innerText(), "130");
    await a11y("review");
    await act("edit");
    await p.selectOption("#recipient", "ali");
    await p.fill("#amount", "12000");
    await p.selectOption("#purpose", "family");
    await p.selectOption("#activity", "normal");
    await submit();
    assert.equal(await p.locator(".score strong").innerText(), "0");
    await p.locator(".revision summary").click();
    assert.match(await p.locator(".revision").innerText(), /130 → 0/);
    assert.equal(await p.locator(".revision li").count(), 4);
    await act("act:cancel");
    await p.keyboard.press("Escape");
    assert.equal((await latest()).status, "pending");
    await act("act:cancel");
    await yes();
    assert.equal((await latest()).status, "canceled");
    await scenario("suspicious");
    const id = (await latest()).id;
    await act("act:hold");
    await act("case:" + id);
    await act("act:request");
    await act("detail:" + id);
    assert.equal((await latest()).status, "requested");
    await act("act:answer");
    await p.selectOption("dialog select", "officialBank");
    await p.check("#attest");
    await yes();
    await act("case:" + id);
    await act("act:keep");
    assert.equal((await latest()).status, "held");
    await act("act:release");
    await yes();
    assert.ok(await p.locator("#reason-error").textContent());
    await p.selectOption("dialog select", "verifiedDetails");
    await yes();
    await act("detail:" + id);
    assert.equal((await latest()).status, "completed");
    assert.equal(await p.locator(".timeline li").count(), 6);
    await scenario("falsePositive");
    await act("act:hold");
    await act("nav:analyst");
    await p.fill("#search", String((await latest()).id));
    assert.equal(await p.locator("tbody tr").count(), 1);
    await p.selectOption("#statusFilter", "completed");
    assert.equal(await p.locator(".empty").count(), 1);
    await p.selectOption("#statusFilter", "held");
    await p.locator("tbody button").click();
    await act("act:falseAlarm");
    await p.selectOption("dialog select", "expectedPayment");
    await yes();
    assert.equal((await latest()).log.at(-1).event, "falseAlarm");
    await act("nav:history");
    await p.selectOption("#statusFilter", "canceled");
    assert.ok((await p.locator("tbody tr").count()) >= 1);
    await p.fill("#search", "nobody");
    assert.equal(await p.locator(".empty").count(), 1);
    await act("lang:kk");
    await p.reload();
    assert.equal(await p.locator("html").getAttribute("lang"), "kk");
    assert.equal((await latest()).status, "completed");
    for (const language of ["kk", "ru"]) {
      await act("lang:" + language);
      await desk();
      await p.locator('#scenarios [data-a="scenario:ordinary"]').focus();
      assert.equal(
        await p.evaluate(() => document.activeElement.dataset.a),
        "scenario:ordinary",
      );
      await p.keyboard.press("Enter");
      await p.check("#codeRequested");
      await submit();
      assert.equal(await p.locator(".score strong").innerText(), "60");
      assert.equal(await p.locator(".evidence-list li b").innerText(), "+60");
      assert.match(
        await p.locator(".advice").innerText(),
        language === "kk" ? /Кодты айтпаңыз/ : /Не сообщайте код/,
      );
      assert.equal(await p.locator('[data-a="act:pay"]').count(), 0);
      await act("edit");
      assert.ok(await p.isChecked("#codeRequested"));
      await submit();
      const codeId = (await latest()).id;
      await act("act:hold");
      await act("case:" + codeId);
      assert.equal(await p.locator('[data-a="act:release"]').count(), 0);
      await act("act:stop");
      await yes();
      assert.ok(await p.locator("dialog").isVisible());
      assert.ok(await p.locator("#reason-error").textContent());
      await p.selectOption("dialog select", "reportedPressure");
      await p.locator("dialog button[value=no]").click();
      assert.equal((await latest()).status, "held");
      await act("act:request");
      await desk();
      await p.locator(".ticket-link").click();
      assert.ok(await p.locator('[data-a="act:dispute"]').isVisible());
      await act("act:dispute");
      await p.keyboard.press("Escape");
      assert.equal((await latest()).status, "requested");
      await act("act:dispute");
      await yes();
      assert.equal((await latest()).status, "stopped");
      await act("nav:analyst");
      assert.equal(await p.inputValue("#statusFilter"), "open");
      await p.fill("#search", String(codeId));
      assert.equal(await p.locator("#results .empty").count(), 1);
      await p.selectOption("#statusFilter", "stopped");
      assert.equal(await p.locator("tbody tr").count(), 1);
      await scenario("suspicious");
      await act("act:hold");
      const stopId = (await latest()).id;
      await act("case:" + stopId);
      await act("act:stop");
      await p.selectOption("dialog select", "recipientMismatch");
      await a11y("stop dialog " + language);
      await yes();
      await p.reload();
      await act("nav:history");
      await p.fill("#search", String(stopId));
      await p.locator("tbody button").click();
      assert.equal(await p.locator(".page-heading .stopped").count(), 1);
      const message = await p
        .locator(".timeline li p:not(.audit-warning)")
        .first()
        .innerText();
      assert.match(message, language === "kk" ? /алушы/ : /получателя/);
      assert.equal((await latest()).log.at(-1).reason, "recipientMismatch");
      // Replay every preset in each interface language.
      for (const [preset, score] of [
        ["ordinary", 0],
        ["ambiguous", 30],
        ["falsePositive", 60],
        ["suspicious", 130],
      ]) {
        await scenario(preset);
        assert.equal(
          await p.locator(".score strong").innerText(),
          String(score),
        );
      }
    }
    for (const l of ["ru", "kk"]) {
      await act("lang:" + l);
      await scenario("suspicious");
      const reviewId = (await latest()).id;
      await act("act:hold");
      await act("case:" + reviewId);
      assert.equal(await p.locator('[data-a="act:release"]').count(), 0);
      await act("act:request");
      await act("nav:analyst");
      await p.fill("#search", String(reviewId));
      await act("queue:requested");
      assert.equal(await p.inputValue("#statusFilter"), "requested");
      assert.equal(await p.locator("tbody tr").count(), 1);
      await act("case:" + reviewId);
      await p.locator(".back").click();
      assert.equal(await p.inputValue("#search"), String(reviewId));
      assert.equal(await p.inputValue("#statusFilter"), "requested");
      await act("case:" + reviewId);
      await act("detail:" + reviewId);
      await act("act:answer");
      await p.selectOption("dialog select", "knownNumber");
      await p.keyboard.press("Escape");
      assert.equal((await latest()).status, "requested");
      await act("act:deferVerification");
      assert.equal((await latest()).status, "held");
      await act("case:" + reviewId);
      assert.match(
        await p.locator(".response-card").innerText(),
        l === "ru" ? /не смог/ : /тексере алмады/,
      );
      assert.equal(await p.locator('[data-a="act:release"]').count(), 0);
      await act("act:request");
      await act("detail:" + reviewId);
      await act("act:answer");
      assert.equal(await p.inputValue("dialog select"), "");
      await p.check("#attest");
      assert.ok(await confirmButton().isDisabled());
      await p.selectOption("dialog select", "inPerson");
      if (l === "kk") await a11y("verify dialog kk");
      await yes();
      assert.equal((await latest()).log.at(-1).channel, "inPerson");
      await act("case:" + reviewId);
      assert.match(
        await p.locator(".response-card").innerText(),
        l === "ru" ? /Личная встреча/ : /жеке кездесу/,
      );
      await act("act:release");
      await p.selectOption("dialog select", "verifiedDetails");
      await yes();
      assert.equal((await latest()).status, "completed");
      await act("nav:analyst");
      await p.fill("#search", String(reviewId));
      await act("queue:actionable");
      assert.equal(await p.inputValue("#statusFilter"), "actionable");
      assert.equal(await p.locator("#results .empty").count(), 1);
      await act("queue:closed");
      assert.equal(await p.locator("tbody tr").count(), 1);
    }
    for (const width of [390, 1440]) {
      await p.setViewportSize({ width, height: 844 });
      for (const lang of ["ru", "kk"]) {
        await act("lang:" + lang);
        await theme.selectOption(
          (width === 390) === (lang === "kk") ? "light" : "dark",
        );
        await scenario("ordinary");
        await act("act:pay");
        assert.equal((await latest()).status, "completed");
        await scenario("ambiguous");
        await act("act:checkedPay");
        await p.selectOption("dialog select", "knownNumber");
        await p.check("#attest");
        await yes();
        assert.equal((await latest()).status, "completed");
        await scenario("suspicious");
        const id = (await latest()).id;
        if (width === 1440)
          await a11y("transfer review " + lang + " " + (await palette()));
        await p.locator(".risk-disclosure summary").focus();
        await p.keyboard.press("Enter");
        assert.ok(
          await p.locator(".risk-disclosure[open] .evidence-list").isVisible(),
        );
        await act("act:hold");
        await act("case:" + id);
        await act("act:request");
        await act("detail:" + id);
        await act("act:mismatch");
        await yes();
        assert.ok(await p.locator("#reason-error").textContent());
        await p.keyboard.press("Escape");
        assert.equal((await latest()).status, "requested");
        await act("act:mismatch");
        await p.selectOption("dialog select", "wrongAmount");
        if (width === 390) await a11y("mismatch " + lang);
        await yes();
        await act("case:" + id);
        assert.ok(await p.locator(".mismatch-note").isVisible());
        assert.equal(
          await p
            .locator('[data-a="act:release"],[data-a="act:request"]')
            .count(),
          0,
        );
        await act("detail:" + id);
        await act("correct");
        await yes();
        assert.equal((await latest()).status, "canceled");
        assert.equal(await p.inputValue("#recipient"), "dana");
        assert.equal(await p.inputValue("#amount"), "");
        await p.fill("#amount", "22000");
        await p.selectOption("#purpose", "goods");
        await p.selectOption("#activity", "normal");
        await submit();
        assert.notEqual((await latest()).id, id);
        assert.equal(await p.locator(".score strong").innerText(), "30");
        await scenario("falsePositive");
        const rentId = (await latest()).id;
        await act("act:hold");
        await act("case:" + rentId);
        await act("act:falseAlarm");
        await p.selectOption("dialog select", "expectedPayment");
        await yes();
        await act("detail:" + rentId);
        assert.equal(await p.locator(".page-heading .completed").count(), 1);
        assert.match(
          await p
            .locator(".timeline li p:not(.audit-warning)")
            .first()
            .innerText(),
          lang === "ru" ? /запланирован/ : /жоспарланған/,
        );
        assert.match(
          await p.locator(".outcome-note").innerText(),
          lang === "ru" ? /запланирован/ : /жоспарланған/,
        );
      }
    }
    for (const width of [360, 390, 768, 1024, 1440]) {
      await p.setViewportSize({ width, height: 850 });
      await desk();
      for (const l of ["ru", "kk"]) {
        await act("lang:" + l);
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "overview overflow " + width + " " + l,
        );
        await act("scenario:ambiguous");
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "form overflow",
        );
        await submit();
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "detail overflow",
        );
        if (width <= 390) {
          await act("act:checkedPay");
          assert.ok(
            await p.locator("dialog").evaluate((d) => {
              const r = d.getBoundingClientRect();
              return (
                r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
              );
            }),
          );
          await p.keyboard.press("Escape");
        }
        await desk();
        if (width <= 780) await act("menu");
        await act("nav:analyst");
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "queue overflow",
        );
        await desk();
      }
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await act("menu");
    await p.locator(".drawer-close").focus();
    await p.keyboard.press("Shift+Tab");
    assert.equal(
      await p.evaluate(() => document.activeElement.dataset.a),
      "reset",
    );
    await p.keyboard.press("Tab");
    assert.ok(
      await p
        .locator(".drawer-close")
        .evaluate((e) => document.activeElement === e),
    );
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(".sidebar.shown").count(), 0);
    await act("menu");
    await p.locator(".drawer-close").click();
    await act("menu");
    await p.locator(".veil").click({ position: { x: 300, y: 150 } });
    await p.setViewportSize({ width: 1440, height: 960 });
    await a11y("overview kk");
    await act("nav:analyst");
    await a11y("queue kk");
    await act("reset");
    await p.locator("dialog button[value=no]").click();
    await act("reset");
    await yes();
    assert.equal(await p.locator(".latest tbody tr").count(), 4);
    const reportRuns = [
      ["ru", 1440],
      ["kk", 1440],
      ["ru", 390],
      ["kk", 390],
    ];
    for (const [iteration, [language, width]] of reportRuns.entries()) {
      const inspectA11y = iteration === 0 || iteration === 3;
      await p.setViewportSize({ width, height: 860 });
      await act("lang:" + language);
      await theme.selectOption(width === 1440 ? "light" : "dark");
      await desk();
      await p.locator('.hub-task[data-a="nav:checkMessage"]').click();
      const input = p.locator("#messageInput"),
        run = () => p.locator("#messageForm button").click();
      await run();
      assert.equal(await input.getAttribute("aria-invalid"), "true");
      await input.evaluate((e) => {
        e.value = "x".repeat(6001);
        e.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await run();
      assert.ok(await p.locator("#messageError").textContent());
      for (const [sample, n] of [
        ["ordinary", 0],
        ["ambiguous", 1],
        ["falsePositive", 1],
        ["suspicious", 5],
        ["bank", 7],
      ]) {
        if (await p.locator('[data-a="message-edit"]').count())
          await act("message-edit");
        await act("message-sample:" + sample);
        await run();
        assert.equal(await p.locator(".message-signals li").count(), n);
        assert.equal(await p.locator("#messageResult a").count(), 0);
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
      }
      if (inspectA11y) await a11y("message evidence " + language);
      await act("message-edit");
      const original = await input.inputValue();
      await input.fill(original + " <img src=x onerror=alert(1)>");
      assert.equal(await p.locator('[data-a="report-message"]').count(), 0);
      await run();
      assert.match(await p.locator(".message-quote").innerText(), /<img/);
      assert.equal(await p.locator(".message-quote img").count(), 0);
      await act("message-edit");
      await act(
        "message-sample:" + (language === "kk" ? "ambiguous" : "suspicious"),
      );
      await run();
      await act("report-message");
      await p.keyboard.press("Escape");
      let saved = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("qalqan.reports.v1")),
      );
      const count = saved.length;
      assert.equal(count, iteration);
      await act("report-message");
      await yes();
      saved = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("qalqan.reports.v1")),
      );
      const id = saved[0].id;
      assert.equal(saved.length, count + 1);
      assert.equal(await p.locator(".page-heading .submitted").count(), 1);
      if (width <= 780) await act("menu");
      await act("nav:analyst");
      assert.ok((await p.locator('[data-a^="case:"]').count()) >= 1);
      await p.fill("#search", "M-" + id);
      assert.equal(await p.locator("tbody tr").count(), 1);
      await act("message-case:" + id);
      assert.equal(
        await p.locator(".message-signals li").count(),
        language === "kk" ? 1 : 5,
      );
      assert.ok(await p.locator(".analyst-brief").isVisible());
      assert.ok(
        !(await p.locator(".analyst-brief").innerText()).includes("undefined"),
      );
      const originalText = saved[0].text;
      const quotes = await p.locator(".brief-evidence q").allTextContents();
      assert.equal(quotes.length, language === "kk" ? 1 : 2);
      for (const quote of quotes) assert.ok(originalText.includes(quote));
      assert.ok(await p.locator(".brief-limit").isVisible());
      if (inspectA11y) await a11y("message analyst " + language);
      const outcome = language === "kk" ? "inconclusive" : "advised",
        reason = language === "kk" ? "contextMissing" : "patternConcern";
      await act("message-outcome:" + outcome);
      await yes();
      assert.ok(await p.locator("#reason-error").textContent());
      await p.selectOption("dialog select", reason);
      await yes();
      await act("message-detail:" + id);
      assert.equal(await p.locator(".page-heading ." + outcome).count(), 1);
      assert.equal(await p.locator(".timeline li").count(), 2);
      assert.ok(await p.locator(".outcome-note").innerText());
      await p.reload();
      if (width <= 780) await act("menu");
      await act("nav:history");
      await p.fill("#search", "M-" + id);
      await act("message-detail:" + id);
      assert.equal(await p.locator(".page-heading ." + outcome).count(), 1);
      await act("message-new");
      assert.equal(await input.inputValue(), "");
    }
    if (await p.locator(".menu-icon").isVisible()) await act("menu");
    await act("reset");
    await yes();
    assert.equal(
      await p.evaluate(
        () => JSON.parse(localStorage.getItem("qalqan.reports.v1")).length,
      ),
      0,
    );
    assert.equal(await p.locator(".latest tbody tr").count(), 4);
    await p.setViewportSize({ width: 1440, height: 940 });
    await act("lang:ru");
    await p.locator('.hub-task[data-a="nav:checkMessage"]').click();
    await act("message-sample:bank");
    assert.match(await p.locator("#messageCount").innerText(), /6000$/);
    await p.locator("#similarityOption").uncheck();
    await p.locator("#messageForm button").click();
    assert.equal(await p.locator(".similarity-result").count(), 0);
    await act("message-edit");
    const original = await p.inputValue("#messageInput");
    await p.locator("#similarityOption").check();
    await p.locator("#messageForm button").click();
    assert.equal(await p.locator("mark").count(), 7);
    await act("save-summary");
    const summary = await p.evaluate(
      () => JSON.parse(localStorage.getItem("qalqan.summaries.v1"))[0],
    );
    assert.equal(summary.signals.length, 7);
    assert.ok(!JSON.stringify(summary).includes(original));
    await act("message-summary:" + summary.id);
    assert.equal(await p.locator(".message-quote").count(), 0);
    await p.locator('.sidebar [data-a="nav:checkMessage"]').click();
    await act("message-transfer");
    assert.equal(await p.inputValue("#purpose"), "safeAccount");
    assert.ok(await p.isChecked("#codeRequested"));
    assert.ok(await p.isChecked('[value="bankClaim"]'));
    await p.selectOption("#recipient", "ali");
    await p.fill("#amount", "5000");
    await submit();
    assert.equal((await latest()).context.includes("urgentTransfer"), true);
    assert.ok(await p.locator('[data-a="act:hold"]').isVisible());
    await act("nav:analyst");
    await act("queue-current");
    assert.ok(await p.locator(".analyst-detail").isVisible());
    await act("nav:checkMessage");
    assert.equal(await p.inputValue("#messageInput"), "");
    await theme.selectOption("dark");
    await a11y("studio dark RU");
    await theme.selectOption("light");
    await a11y("studio light RU");
    await p.reload();
    assert.equal(await palette(), "light");
    await p.locator('.sidebar [data-a="nav:checkMessage"]').click();
    await act("mode:voice");
    await p.context().grantPermissions(["microphone"], { origin: base });
    await act("voice-record");
    await p.locator('[data-a="voice-stop"]').waitFor();
    await p.waitForTimeout(320); // Allow the simulated microphone to produce a decodable frame.
    await act("voice-stop");
    await p.locator("#voicePlayback").waitFor();
    const clip = await p.locator("#voicePlayback").getAttribute("src");
    assert.match(clip, /^blob:/);
    await p.waitForFunction(
      () => document.querySelector("#voicePlayback")?.readyState >= 2,
    );
    await act("voice-remove");
    assert.equal(await p.locator("#voicePlayback").count(), 0);
    await p.locator("#voiceFile").setInputFiles({
      name: "invalid.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("fake"),
    });
    assert.match(await p.locator(".voice-status").innerText(), /8 МБ/);
    await a11y("voice studio dark");
    await p.fill(
      "#messageInput",
      "Продиктуйте цифры из сообщения для подтверждения личности.",
    );
    await p.locator("#messageForm button").click();
    assert.match(
      await p.locator(".similarity-result").innerText(),
      /Запрос кода/,
    );
    await act("reset");
    await yes();
    assert.equal(
      await p.evaluate(
        () => JSON.parse(localStorage.getItem("qalqan.summaries.v1")).length,
      ),
      0,
    );
    await p.evaluate(() => localStorage.setItem("qalqan.reports.v1", "{"));
    await p.reload();
    assert.equal(await p.locator("[role=status].notice").count(), 1);
    assert.equal(await p.locator(".latest tbody tr").count(), 4);
    await p.evaluate(() => localStorage.removeItem("qalqan.reports.v1"));
    await p.evaluate(() => localStorage.setItem("qalqan.records.v1", "{"));
    await p.reload();
    assert.equal(await p.locator("[role=status].notice").count(), 1);
    // The event backup needs only loopback HTTP. Block every other browser request.
    const bundle = resolve(
      mkdtempSync(resolve(tmpdir(), "qalqan-check-")),
      "index.html",
    );
    execFileSync("python3", [
      resolve(__dirname, "../tools/package_demo.py"),
      bundle,
    ]);
    const server = http.createServer((req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(readFileSync(bundle));
    });
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
    try {
      const url = "http://127.0.0.1:" + server.address().port + "/";
      const offline = await b.newContext();
      const outside = [];
      await offline.route("**/*", (route) => {
        if (route.request().url() === url) return route.continue();
        outside.push(route.request().url());
        return route.abort();
      });
      const f = await offline.newPage();
      await f.goto(url);
      await f.locator('[data-a="entry:customer"]').click();
      await f.locator("#accessForm button[type=submit]").click();
      await f.locator('[data-a="scenario:ambiguous"]').click();
      await f.locator("#transferForm button").click();
      await f.locator('[data-a="act:checkedPay"]').click();
      await f.selectOption("dialog select", "inPerson");
      await f.check("#attest");
      await f.locator("dialog button[value=yes]").click();
      assert.equal(await f.locator(".page-heading .completed").count(), 1);
      await f.locator('.sidebar [data-a="nav:checkMessage"]').click();
      await f.locator('[data-a="message-sample:suspicious"]').click();
      await f.locator("#messageForm button").click();
      assert.equal(await f.locator("mark").count(), 5);
      await f.locator('[data-a="report-message"]').click();
      await f.locator("dialog button[value=yes]").click();
      assert.equal(await f.locator(".page-heading .submitted").count(), 1);
      assert.deepEqual(outside, []);
      await offline.close();
    } finally {
      server.close();
    }
    const disabled = await b.newContext();
    await disabled.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });
    const g = await disabled.newPage();
    await g.goto(base);
    await g.locator('[data-a="entry:customer"]').click();
    await g.locator("#accessForm button[type=submit]").click();
    assert.equal(await g.locator(".notice").count(), 1);
    await g.locator('[data-a="scenario:ordinary"]').click();
    await g.locator("#transferForm button").click();
    await g.locator('[data-a="act:pay"]').click();
    assert.equal(await g.locator(".page-heading .completed").count(), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: customer/analyst journeys, editing, validation, filters, dialogs, profile switching, persistence, reset, bilingual widths, storage fallbacks, message reports and offline checkout." +
        (process.env.AXE_JS
          ? " " + scanned + " screen/dialog checks scanned with axe."
          : ""),
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
