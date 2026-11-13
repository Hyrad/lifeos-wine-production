import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const url = process.env.CHECK_URL || "http://127.0.0.1:4174/lifeos-wine-production/";
const { displayVersion, version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const shots = process.env.SCREENSHOT_DIR || "test-results";
const sections = [
  ["planned", "Planned Batches"], ["batches", "Active Batches"], ["archive", "Production History"],
  ["recipes", "Recipe Library"], ["approvals", "Approval Status"], ["actions", "Production Actions"],
  ["methods", "Methods & Guides"], ["documents", "Photos & Documents"], ["ideas", "Ideas & Experiments"],
];
const viewports = [
  ["desktop", 1440, 900], ["desktop-compact", 1280, 800],
  ["ipad-landscape", 1180, 820], ["ipad-portrait", 820, 1180], ["ipad-mini", 744, 1133],
  ["iphone", 390, 844], ["small-phone", 320, 720],
];
let checks = 0, axeRuns = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const ok = (condition, label) => { assert.ok(condition, label); checks++; };
const evidence = [];
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
await mkdir(shots, { recursive: true });
try {
  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1200, isMobile: width < 1200, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [], external = [];
    context.on("request", req => { if (new URL(req.url()).origin !== new URL(url).origin) external.push(req.url()); });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("requestfailed", req => errors.push(req.url()));
    page.on("response", resp => { if (resp.status() >= 400) errors.push(`${resp.status()}: ${resp.url()}`); });
    equal((await page.goto(url, { waitUntil: "networkidle" })).status(), 200, `${name}: page response`);
    await page.getByRole("heading", { level: 1, name: "Wine Production." }).waitFor();
    equal(await page.locator(".wine-card h3").allTextContents(), sections.map(s => s[1]), `${name}: all sections in order`);
    equal(await page.locator(".wine-production-grid .wine-card h3").allTextContents(), sections.slice(0, 3).map(s => s[1]), `${name}: primary sections`);
    equal(await page.locator(".wine-resources-grid .wine-card").first().getAttribute("id"), "recipes", `${name}: recipes lead the second group`);
    equal(await page.locator(".release-version").textContent(), `v${displayVersion}`, `${name}: display version`);
    equal(await page.locator(".footer-wordmark span").textContent(), `v${displayVersion}`, `${name}: footer version`);
    equal(await page.locator(".profile small span").textContent(), `v${displayVersion}`, `${name}: sidebar version`);
    equal(version, `${displayVersion}.0`, `${name}: valid package version mapping`);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal overflow`);
    const primary = await Promise.all(["planned", "batches", "archive"].map(id => page.locator(`#${id}`).boundingBox()));
    const recipe = await page.locator("#recipes").boundingBox();
    if (width > 700) {
      ok(primary.every(box => Math.abs(box.y - primary[0].y) < 1), `${name}: one primary row`);
      ok(primary[0].x < primary[1].x && primary[1].x < primary[2].x, `${name}: primary left-to-right order`);
      if (width > 980) {
        ok(primary.every(box => box.y + box.height <= height), `${name}: full primary cards immediately visible`);
        const approval = await page.locator("#approvals").boundingBox();
        const actions = await page.locator("#actions").boundingBox();
        ok(recipe.y > primary[0].y + primary[0].height && Math.abs(recipe.y - approval.y) < 1 && Math.abs(recipe.y - actions.y) < 1, `${name}: Recipe Library leads row two`);
        const frame = await page.locator(".wine-production").boundingBox();
        ok(Math.abs(recipe.x - frame.x) < 1, `${name}: Recipe Library aligns with Production frame`);
      } else {
        const grid = await page.locator(".wine-resources-grid").boundingBox();
        ok(Math.abs(recipe.width - grid.width) < 1, `${name}: Recipe Library spans tablet resources`);
      }
    } else {
      ok(primary[0].y < primary[1].y && primary[1].y < primary[2].y && primary[2].y < recipe.y, `${name}: stacked mobile order`);
    }
    const small = await page.locator("a").evaluateAll(links => links.filter(link => {
      const rect = link.getBoundingClientRect();
      return !link.classList.contains("skip-link") && rect.width && rect.height && getComputedStyle(link).visibility !== "hidden" && rect.height < 44;
    }).map(link => ({ text: link.textContent.trim(), height: link.getBoundingClientRect().height })));
    equal(small, [], `${name}: 44px link targets`);
    equal(await page.getByRole("link", { name: "Back to LifeOS Home" }).getAttribute("href"), "https://hyrad.github.io/lifeos-home/", `${name}: Home return`);
    ok(await page.getByText("Navigation only · Your current records stay in Notion.", { exact: true }).isVisible(), `${name}: no-live-data label`);
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifestURL = new URL(manifestHref, url).href;
    const manifest = await (await page.request.get(manifestURL)).json();
    equal([manifest.id, manifest.scope, manifest.start_url, manifest.display], ["/lifeos-wine-production/", "/lifeos-wine-production/", "/lifeos-wine-production/", "standalone"], `${name}: installable scope`);
    for (const icon of manifest.icons) {
      const resp = await page.request.get(new URL(icon.src, manifestURL).href);
      equal(resp.status(), 200, `${name}: icon response`);
      ok(/image\/png/.test(resp.headers()["content-type"]), `${name}: local PNG icon`);
    }
    const apple = await page.request.get(new URL(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"), url).href);
    equal(apple.status(), 200, `${name}: Apple icon`);
    equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute("content"), "yes", `${name}: Apple standalone metadata`);
    ok((await page.locator('meta[name="viewport"]').getAttribute("content")).includes("viewport-fit=cover"), `${name}: safe-area viewport`);
    ok((await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")).includes("connect-src 'self'"), `${name}: CSP preserved`);
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    equal(scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `${name}: accessibility`);
    axeRuns++;
    await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
    await page.screenshot({ path: `${shots}/${name}-viewport.png` });
    evidence.push({ name, width, height, primary, recipe });
    // Verify every destination is reachable from both retained navigation sets.
    for (const navName of ["Main navigation", "Wine page sections"]) {
      for (const [id, title] of sections) {
        await page.getByRole("navigation", { name: navName }).getByRole("link", { name: title, exact: true }).click();
        equal(new URL(page.url()).hash, `#${id}`, `${name}: ${navName} ${id}`);
        const heading = await page.locator(`#${id} h3`).boundingBox();
        ok(heading.y >= 0 && heading.y < height, `${name}: ${id} heading reachable`);
      }
    }
    for (const [id] of sections) {
      await page.goto(new URL(`#${id}`, url).href);
      await page.reload({ waitUntil: "networkidle" });
      equal(new URL(page.url()).hash, `#${id}`, `${name}: direct anchor reload ${id}`);
      await page.locator(`#${id} h3`).waitFor();
    }
    equal(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0], `${name}: no browser records`);
    ok(await page.evaluate(() => navigator.serviceWorker?.controller == null), `${name}: no service worker claim`);
    equal(errors, [], `${name}: browser/network errors`);
    equal(external, [], `${name}: unexpected external requests`);
    await context.close();
    console.log(`${name}: production order/visibility, Recipe Library placement, all anchors/reloads, touch targets, accessibility and installability PASS`);
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(new URL("index.html", url).href);
  await page.getByRole("heading", { level: 1, name: "Wine Production." }).waitFor();
  equal(await page.locator(".wine-card").count(), 9, "direct index URL");
  await page.goto(url);
  await page.getByRole("heading", { level: 1, name: "Wine Production." }).waitFor();
  await page.keyboard.press("Tab");
  ok(await page.getByRole("link", { name: "Skip to content" }).evaluate(el => el === document.activeElement), "keyboard skip link first");
  await page.keyboard.press("Enter");
  ok(await page.locator("main").evaluate(el => el === document.activeElement), "keyboard skip focuses main");
  const planned = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Planned Batches", exact: true });
  await planned.focus();
  ok(await planned.evaluate(el => el.matches(":focus-visible") && getComputedStyle(el).outlineStyle !== "none"), "visible keyboard focus");
  await page.keyboard.press("Enter");
  equal(new URL(page.url()).hash, "#planned", "keyboard section navigation");
  // All external navigations are intercepted; no Notion/Drive/private content is read.
  const destinations = await page.locator('a[href^="https://"]').evaluateAll(links => [...new Set(links.map(link => link.href))]);
  equal(destinations.length, 12, "original destinations, filtered batch views and direct Recipe Ledger");
  for (const destination of destinations) {
    await context.route(destination, route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Navigation probe</title><p>Navigation probe</p>" }));
    await page.goto(url);
    const link = page.locator(`a[href="${destination}"]`).first();
    if (await link.getAttribute("target") === "_blank") {
      equal(await link.getAttribute("rel"), "noopener noreferrer", "safe new-tab link");
      const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
      await popup.waitForURL(destination);
      equal(await popup.locator("body").innerText(), "Navigation probe", "intercepted external destination");
      await popup.close();
    } else {
      equal(destination, "https://hyrad.github.io/lifeos-home/", "same-tab Home link");
      await link.click();
      await page.waitForURL(destination);
      equal(await page.locator("body").innerText(), "Navigation probe", "intercepted Home return");
    }
  }
  await context.close();
} finally { await browser.close(); }
await writeFile(`${shots}/browser-result.json`, JSON.stringify({ status: "PASS", checks, viewports: viewports.length, axeRuns, version, displayVersion, passiveExternalRequests: 0, physicalDeviceAcceptance: "pending", geometry: evidence }, null, 2));
console.log(`Browser PASS: ${checks} assertions, ${viewports.length} viewports, ${axeRuns} axe scans; keyboard, all retained anchors, 12 intercepted outbound destinations; zero unexpected external requests. Physical iPhone/iPad installation remains unverified.`);
