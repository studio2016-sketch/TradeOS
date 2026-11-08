/** Optional local-only browser check. Requires Playwright and a local production server. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = new URL(process.env.PAPER_WORKSPACE_URL || "http://127.0.0.1:3012");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("This check only accepts localhost; no deployed provider calls.");
const output = process.env.PAPER_QA_OUTPUT || "/tmp/tradeos-paper-ui";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const blockedRequests = [], errors = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== base.origin || url.pathname.startsWith("/api/")) {
      blockedRequests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const fill = async (values = {}) => {
    const defaults = { equity: "10000", riskPercent: "1", entry: "100", stop: "98", target: "104" };
    for (const [key, value] of Object.entries({ ...defaults, ...values })) await page.locator(`#paper-${key}`).fill(value);
  };
  const count = async expected => assert.equal(await page.locator(".paperDrafts li").count(), expected);
  const shares = async expected => assert.equal(await page.locator(".paperShares strong").textContent(), expected);
  const save = () => page.getByRole("button", { name: "Save arithmetic draft on this page", exact: true });
  await page.goto(new URL("/paper-workspace", base).href);
  await page.getByRole("heading", { name: "Build a hypothetical risk plan" }).waitFor();
  assert.equal(await page.locator("input").count(), 5);
  assert.deepEqual(await page.locator("input").evaluateAll(inputs => inputs.map(input => input.value)), ["", "", "", "", ""]);
  assert.ok(await save().isDisabled());
  await fill();
  await shares("50");
  await save().click();
  await count(1);
  assert.ok(await page.getByRole("button", { name: "Draft already saved on this page" }).isDisabled());
  await page.locator("#paper-riskPercent").fill("0.5");
  await shares("25");
  assert.match(await page.locator(".paperDrafts").textContent(), /50 whole shares/);
  await save().click();
  await count(2);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "No mobile horizontal overflow");
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "Reset inputs", exact: true }).click();
  await count(2);
  assert.equal(await page.locator(".paperShares").count(), 0);
  await page.getByRole("button", { name: "Load draft 1 into inputs", exact: true }).click();
  await shares("50");
  await page.getByRole("button", { name: "Remove draft 1", exact: true }).click();
  await count(1);
  assert.match(await page.locator(".paperDrafts").textContent(), /25 whole shares/);
  await page.getByRole("button", { name: "Clear session journal", exact: true }).click();
  await count(0);
  await page.locator("#paper-stop").fill("100");
  assert.equal(await page.locator(".paperShares").count(), 0);
  assert.equal(await page.locator("#paper-stop").getAttribute("aria-invalid"), "true");
  await fill({ riskPercent: "1e2" });
  assert.equal(await page.locator(".paperShares").count(), 0);
  await fill({ equity: "1" });
  await shares("0");
  assert.ok(await save().isDisabled());
  await fill();
  for (let i = 0; i < 20; i++) {
    await page.locator("#paper-target").fill(String(104 + i));
    await save().click();
  }
  await count(20);
  await page.locator("#paper-target").fill("999");
  assert.ok(await page.getByRole("button", { name: "Session journal full" }).isDisabled());
  assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
  await page.reload();
  await count(0);
  assert.deepEqual(await page.locator("input").evaluateAll(inputs => inputs.map(input => input.value)), ["", "", "", "", ""]);
  await fill();
  await save().click();
  const savedBeforeNavigation = await page.locator(".paperDrafts").textContent();
  await page.goto("about:blank");
  await page.goBack();
  await page.getByRole("heading", { name: "Build a hypothetical risk plan" }).waitFor();
  const restoredCount = await page.locator(".paperDrafts li").count();
  assert.ok(restoredCount === 0 || restoredCount === 1, "Back may restore the intact in-memory page or create a fresh page");
  if (restoredCount === 1) {
    assert.equal(await page.locator(".paperDrafts").textContent(), savedBeforeNavigation);
    await shares("50");
  } else {
    assert.deepEqual(await page.locator("input").evaluateAll(inputs => inputs.map(input => input.value)), ["", "", "", "", ""]);
  }
  await page.reload();
  await count(0);
  assert.deepEqual(await page.locator("input").evaluateAll(inputs => inputs.map(input => input.value)), ["", "", "", "", ""]);
  await page.goForward();
  assert.equal(page.url(), "about:blank");
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, [], "Standalone planner must never attempt an API or external request");
  console.log(JSON.stringify({ status: "passed", flows: ["blank defaults", "calculation", "duplicate prevention", "edit snapshot isolation", "mobile overflow", "reset", "load", "remove", "clear", "invalid input", "zero shares", "journal bound", "no browser storage", "reload", "back and forward"], browserErrors: errors, apiOrExternalRequests: blockedRequests, screenshots: [`${output}/desktop.png`, `${output}/mobile.png`] }, null, 2));
} finally {
  await browser.close();
}
