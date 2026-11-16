import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--config",
    "vite.local.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    "5174",
  ],
  { stdio: "pipe" },
);
server.stderr.on("data", (d) => process.stderr.write(d));
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5174")).ok) break;
    } catch {
      /* Wait for the temporary test server. */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--single-process", "--no-zygote"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5174");
  await page
    .getByRole("heading", { name: "Small moves. Big main-character energy." })
    .waitFor();
  await page.screenshot({ path: "../studio-desktop.png", fullPage: true });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const count = () => page.locator(".move:not(.empty)").count();
  const rect = await page.locator("#stage").boundingBox();
  assert.ok(rect);
  const scale = Math.min(rect.height / 3.5, rect.width / 2.9),
    x = rect.x + rect.width / 2,
    y = rect.y + rect.height * 0.57 - 1.16 * scale;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 6 });
  await page.mouse.up();
  assert.equal(await count(), 1);
  await button("Clear").click();
  await button("Try a groove ↗").click();
  assert.equal(await count(), 6);
  await page.getByRole("button", { name: "Play my dance" }).click();
  await page.getByRole("button", { name: "Stop the dance" }).waitFor();
  await page.getByRole("button", { name: "Stop the dance" }).click();
  await button("↶ Undo").click();
  assert.equal(await count(), 5);
  await button("↷ Redo").click();
  assert.equal(await count(), 6);
  await button("♡ Save dance").click();
  await button("Clear").click();
  assert.equal(await count(), 0);
  await button("Load saved dance").click();
  await page.locator(".move:not(.empty)").first().waitFor();
  assert.equal(await count(), 6);
  await button("Share your dance ↗").click();
  const code = await page
    .getByRole("textbox", { name: "Dance code", exact: true })
    .inputValue();
  assert.equal(JSON.parse(code).steps.length, 6);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await button("Choose Peach, the sunshine").click();
  assert.equal(await page.locator("#dancer-name").textContent(), "Peach");
  await button("Clear").click();
  await page.locator("#body-part").selectOption("head");
  await page.locator("#angle").fill("20");
  await button("＋ Record this move").click();
  assert.equal(await count(), 1);
  await button("Have a dance code? Import it ↗").click();
  await page
    .getByRole("textbox", { name: "Paste dance code", exact: true })
    .fill("invalid");
  await button("Load this dance ↗").click();
  assert.equal(await page.getByRole("dialog").isVisible(), true);
  await page
    .getByRole("textbox", { name: "Paste dance code", exact: true })
    .fill(code);
  await button("Load this dance ↗").click();
  assert.equal(await count(), 6);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../studio-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/mobile, playback, undo/redo, save/load, character choice, recording, invalid/valid import, share code. No page errors.",
  );
} finally {
  if (browser) await browser.close();
  server.kill();
}
