import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const url =
  process.env.CHECK_URL || "http://127.0.0.1:4174/lifeos-wine-production/";
const { version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
});
await mkdir("test-results", { recursive: true });
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  const unexpected = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => errors.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()}: ${response.url()}`);
  });
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(url).origin)
      unexpected.push(request.url());
  });
  for (const [name, width, height] of [
    ["desktop", 1440, 1080],
    ["tablet", 820, 1180],
    ["phone", 390, 844],
    ["small-phone", 320, 720],
  ]) {
    await page.setViewportSize({ width, height });
    const response = await page.goto(url, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page
      .getByRole("heading", { level: 1, name: "Wine Production." })
      .waitFor();
    assert.equal(await page.locator(".wine-card").count(), 8);
    for (const name of ["Active Batches", "Batch History", "Recipe Library", "Approval Status"]) {
      await page.getByRole("heading", { name, exact: true }).waitFor();
    }
    assert.equal(
      await page.locator(".release-version").textContent(),
      `v${version}`,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${name}: horizontal overflow`,
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Back to LifeOS Home" })
        .getAttribute("href"),
      "https://hyrad.github.io/lifeos-home/",
    );
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      scan.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
      [],
      `${name}: accessibility`,
    );
    await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    await page
      .getByRole("navigation", { name: "Wine page sections" })
      .getByRole("link", { name: /Methods/ })
      .click();
    assert.equal(new URL(page.url()).hash, "#methods");
    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByRole("heading", { level: 1, name: "Wine Production." })
      .waitFor();
    console.log(
      `${name}: standalone page, version, anchors/reload, layout and accessibility passed`,
    );
  }
  await page.goto(new URL("index.html", url).href, {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("heading", { level: 1, name: "Wine Production." })
    .waitFor();
  await page.goto(url);
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .getByRole("link", { name: "Skip to content" })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .locator("main")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(
    unexpected,
    [],
    "Unexpected third-party/private API requests",
  );
  console.log("Keyboard and network-boundary checks passed.");
} finally {
  await browser.close();
}
