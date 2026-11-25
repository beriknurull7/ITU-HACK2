// Browser checks for local profiles, case investigation and the network.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_BIN || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 920 },
      colorScheme: "light",
    });
    const base = process.env.DEMO_URL || "http://127.0.0.1:4271";
    const page = await context.newPage();
    page.setDefaultTimeout(4500);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const byAction = (action) =>
      page.locator(`[data-a="${action}"]:visible`).first();
    const click = (action) => byAction(action).click();
    const signIn = () =>
      page.locator("#accessForm button[type=submit]").click();
    const confirm = () => page.locator("dialog button[value=yes]").click();
    const latest = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("qalqan.records.v1"))[0],
      );
    let scanned = 0;
    async function scan(label) {
      if (!process.env.AXE_JS) return;
      await page.addScriptTag({ path: process.env.AXE_JS });
      const failures = await page.evaluate(async () =>
        (
          await axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations.map((v) => [v.id, v.nodes.map((n) => n.target)]),
      );
      assert.deepEqual(failures, [], label);
      scanned += 1;
    }
    async function hold(preset) {
      await click("nav:overview");
      await click("scenario:" + preset);
      await page
        .locator(
          "#transferForm button[type=submit], #transferForm button.primary",
        )
        .first()
        .click();
      await click("act:hold");
      return (await latest()).id;
    }

    await page.goto(base);
    const themeToggle = byAction("top-menu:theme");
    assert.ok(await themeToggle.getAttribute("title"));
    await page.keyboard.press("Tab");
    await themeToggle.focus();
    assert.equal(
      await themeToggle.evaluate((el) => getComputedStyle(el).outlineStyle),
      "solid",
    );
    await page.keyboard.press("Enter");
    assert.equal(await themeToggle.getAttribute("aria-expanded"), "true");
    await scan("theme menu");
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.a),
      "theme:system",
    );
    await page.keyboard.press("Escape");
    assert.equal(await themeToggle.getAttribute("aria-expanded"), "false");

    await click("entry:analyst");
    await click("entry-register");
    await page.fill("#displayName", "Арман Тест");
    await page.fill("#demoEmail", "reviewer@qalqan.example");
    await signIn();
    await click("sign-in");
    assert.equal(
      await page.locator("#profileMenu strong").textContent(),
      "Арман Тест",
    );
    assert.ok(await page.locator("#profileMenu small").textContent());
    await click("other-role");
    await click("entry:customer");
    await page.fill("#accountLogin", "reviewer@qalqan.example");
    await signIn();
    assert.equal(
      await page.locator("#accountLogin").getAttribute("aria-invalid"),
      "true",
    );
    await click("entry-register");
    await page.fill("#displayName", "Клиент Тест");
    await page.fill("#demoEmail", "reviewer@qalqan.example");
    await signIn();
    assert.equal(
      await page.locator("#demoEmail").getAttribute("aria-invalid"),
      "true",
    );
    await click("entry-register");
    await page.fill("#accountLogin", "aliya@qalqan.example");
    await signIn();
    const first = await hold("suspicious");
    const second = await hold("suspicious");
    const low = await hold("ordinary");
    assert.equal(await page.locator('[data-a="nav:network"]').count(), 0);
    await click("sign-in");
    await click("other-role");
    await click("entry:analyst");
    await page.fill("#accountLogin", "Арман Тест");
    await signIn();
    await page.fill("#search", "Алия");
    assert.ok((await page.locator("#results tbody tr").count()) >= 5);
    await page.selectOption("#queueRisk", "low");
    assert.equal(await page.locator("#results tbody tr").count(), 1);
    assert.match(
      await page.locator("#results tbody tr").textContent(),
      new RegExp("#" + low),
    );
    await page.selectOption("#queueRisk", "high");
    await page.selectOption("#queueSort", "oldest");
    const old = await page
      .locator("#results tbody tr:first-child button")
      .getAttribute("data-a");
    await page.selectOption("#queueSort", "newest");
    const recent = await page
      .locator("#results tbody tr:first-child button")
      .getAttribute("data-a");
    assert.notEqual(old, recent);
    await page.selectOption("#queueDays", "1");
    assert.ok(await page.locator("#results tbody tr").count());
    await scan("filtered investigation queue");
    await click("clear-queue");
    assert.equal(await page.inputValue("#search"), "");
    await click("nav:network");
    await click("network-mode:list");
    assert.equal(await page.locator("#networkCanvas").count(), 0);
    await click("network-mode:space");
    assert.ok(await page.locator("#networkCanvas").isVisible());
    await page.selectOption("#networkRisk", "low");
    const canvas = page.locator("#networkCanvas");
    const frame = await canvas.boundingBox();
    await page.mouse.click(
      frame.x + frame.width / 2,
      frame.y + frame.height / 2,
    );
    assert.match(
      await page.locator("#networkInspect h2").textContent(),
      new RegExp("#" + low),
    );
    const canvasData = () => canvas.evaluate((c) => c.toDataURL());
    const initial = await canvasData();
    await canvas.focus();
    await page.keyboard.press("+");
    await page.waitForFunction(
      (prev) => document.querySelector("#networkCanvas").toDataURL() !== prev,
      initial,
    );
    const zoomed = await canvasData();
    await page.mouse.move(frame.x + 25, frame.y + frame.height / 2);
    await page.mouse.down();
    await page.mouse.move(frame.x + 110, frame.y + frame.height / 2 + 30, {
      steps: 5,
    });
    await page.mouse.up();
    assert.notEqual(await canvasData(), zoomed);
    await click("camera:reset");
    await page.waitForFunction(
      (prev) => document.querySelector("#networkCanvas").toDataURL() === prev,
      initial,
    );
    await page.selectOption("#networkStatus", "closed");
    assert.ok(await page.locator("#networkBody .empty").isVisible());
    await click("clear-network");
    await page.selectOption("#networkNode", "recipient:dana");
    assert.equal(await page.locator("#networkLinks button").count(), 3);
    await click("network-edge:" + second);
    assert.match(
      await page.locator("#networkInspect h2").textContent(),
      new RegExp("#" + second),
    );
    assert.ok(await page.locator("#networkInspect li").count());
    await scan("3D network");
    await click("case:" + second);
    assert.ok(
      await page.locator(`.related-cases [data-a="case:${first}"]`).isVisible(),
    );
    assert.ok(await page.locator(".evidence-limits").isVisible());
    const findings = page.locator(".brief-evidence li");
    assert.equal(await findings.count(), 2);
    assert.match(await findings.first().textContent(), /безопасный счёт/i);
    assert.match(
      await page.locator(".brief-limit").textContent(),
      /учебных реквизитах/,
    );
    assert.ok(await page.locator(".audit-warning").isVisible());
    const noteSubmit = page.locator("#caseNoteForm button[type=submit]");
    await noteSubmit.click();
    assert.equal(
      await page.locator("#caseNote").getAttribute("aria-invalid"),
      "true",
    );
    const note = "Демо: уточнить заявленное назначение.";
    await page.fill("#caseNote", note);
    await noteSubmit.click();
    assert.ok((await page.locator(".notes-list").textContent()).includes(note));
    await page.reload();
    assert.match(await page.locator(".notes-list").textContent(), /Арман Тест/);
    await click("act:request");
    await page.locator("dialog button[value=no]").click();
    assert.equal((await latest()).status, "held");
    await click("act:request");
    await page.selectOption("dialog select", "verifyDetailsRequest");
    await confirm();
    assert.match(await page.locator(".timeline").textContent(), /Арман Тест/);
    await click("detail:" + second);
    await signIn();
    assert.equal(await page.locator(".page-heading .requested").count(), 1);
    assert.equal(await page.locator(".case-notes").count(), 0);
    await click("act:answer");
    await page.selectOption("dialog select", "knownNumber");
    await page.check("#attest");
    await confirm();
    await click("case:" + second);
    await page.fill("#accountLogin", "reviewer@qalqan.example");
    await signIn();
    await click("act:release");
    await page.selectOption("dialog select", "verifiedDetails");
    await confirm();
    assert.equal(await page.locator(".page-heading .completed").count(), 1);
    assert.equal((await latest()).log.at(-1).actor.name, "Арман Тест");
    assert.equal((await latest()).log.at(-1).reason, "verifiedDetails");

    await click("case-visual");
    assert.ok(await page.locator("#caseCanvas").isVisible());
    await page.selectOption("#timelineEvent", "0");
    assert.match(
      await page.locator("#timelineEventInfo").textContent(),
      /создал/i,
    );
    await scan("case chronology");
    await click("nav:decisions");
    await page.fill("#decisionSearch", "Арман Тест");
    await page.selectOption("#decisionScope", "release");
    assert.equal(await page.locator(".decisions-table tbody tr").count(), 1);
    assert.match(
      await page.locator(".decisions-table").textContent(),
      new RegExp("#" + second),
    );
    await click("case:" + second);
    assert.equal(
      await page.locator(".back").getAttribute("data-a"),
      "nav:decisions",
    );
    await click("nav:reports");
    assert.ok(await page.locator("#results .empty").isVisible());
    await click("nav:rules");
    await page.fill("#sandboxLow", "55");
    await page.fill("#sandboxHigh", "20");
    await page.locator("#rulesForm button[type=submit]").click();
    assert.ok(await page.locator("#ruleError").textContent());
    await page.fill("#sandboxHigh", "100");
    await page.locator("#rulesForm button[type=submit]").click();
    assert.match(
      await page.locator("#ruleResult").textContent(),
      /средний.*низкий/i,
    );
    assert.equal((await latest()).status, "completed");
    await scan("rule sandbox");
    await click("nav:network");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 360, height: 820 });
    await click("lang:kk");
    assert.equal(await page.locator("#networkCanvas").count(), 0);
    const linked = byAction("network-edge:" + second);
    await linked.focus();
    await page.keyboard.press("Enter");
    assert.equal(await linked.getAttribute("aria-pressed"), "true");
    assert.equal(
      await linked.evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await click("top-menu:theme");
    assert.equal(
      await page
        .locator("#themeMenu")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    await click("theme:dark");
    await scan("2D network mobile Kazakh");
    await click("case:" + second);
    await click("detail:" + second);
    await signIn();
    assert.equal(await page.locator(".page-heading .completed").count(), 1);
    assert.equal(await page.locator(".case-notes").count(), 0);
    assert.equal(await page.locator("#caseCanvas").count(), 0);
    await click("menu");
    await click("nav:help");
    await click("nav:transfer");
    assert.ok(await page.locator("#transferForm").isVisible());
    await click("menu");
    await click("nav:help");
    await click("nav:checkMessage");
    assert.ok(await page.locator("#messageForm").isVisible());
    await click("menu");
    await click("nav:help");
    await click("help-reports");
    assert.equal(
      await page
        .locator('[data-a="history-mode:reports"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    await click("history-mode:all");
    await click("sign-in");
    await click("profile-settings");
    await page.fill("#renameProfile", "Отменённое имя");
    await click("profile-close");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.match(
      await page.locator("#profileButton").getAttribute("aria-label"),
      /Алия/,
    );
    const newVisit = await context.newPage();
    await newVisit.goto(base);
    assert.match(
      await newVisit.locator("#profileButton").getAttribute("aria-label"),
      /Алия/,
    );
    await newVisit.close();
    const fallbackContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await fallbackContext.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    const fallbackPage = await fallbackContext.newPage();
    await fallbackPage.goto(base);
    await fallbackPage.locator('[data-a="entry:analyst"]').click();
    await fallbackPage.locator('#accessForm button[type="submit"]').click();
    await fallbackPage.locator('[data-a="nav:network"]').click();
    assert.equal(await fallbackPage.locator("#networkCanvas").count(), 0);
    assert.ok(
      await fallbackPage.locator('[data-a="network-mode:space"]').isDisabled(),
    );
    assert.ok(await fallbackPage.locator("#networkFallback").isVisible());
    await fallbackContext.close();
    assert.deepEqual(errors, []);
    console.log(
      `PASS: profiles, theme and focus, queue filters, canvas gestures, 2D navigation, related cases, notes and audit, and customer outcome. ${scanned} axe scans.`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
