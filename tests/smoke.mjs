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
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5174");
  await page.locator("#stage").waitFor();
  const button = (name) => page.getByRole("button", { name, exact: true });
  const count = () => page.locator(".move:not(.empty)").count();
  const fitsOneScreen = () =>
    page.evaluate(() => {
      const play = document.getElementById("play").getBoundingClientRect();
      return (
        document.documentElement.scrollHeight <= window.innerHeight &&
        document.documentElement.scrollWidth <= window.innerWidth &&
        play.bottom <= window.innerHeight
      );
    });
  assert.equal(await fitsOneScreen(), true, "desktop fits one screen");
  const dragFromHead = async (dx, dy) => {
    const rect = await page.locator("#stage").boundingBox();
    assert.ok(rect);
    const scale = Math.min(rect.height / 3.5, rect.width / 2.9),
      x = rect.x + rect.width / 2,
      y = rect.y + rect.height * 0.57 - 1.16 * scale;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 6 });
    await page.mouse.up();
  };
  await dragFromHead(40, 20);
  assert.equal(await count(), 1);
  await button("Clear").click();
  await button("Try a groove ↗").click();
  assert.equal(await count(), 6);
  await page.screenshot({ path: "../studio-desktop.png" });
  await page.getByRole("button", { name: "Play my dance" }).click();
  await page.getByRole("button", { name: "Stop the dance" }).waitFor();
  await page.getByRole("button", { name: "Stop the dance" }).click();
  await button("↶ Undo").click();
  assert.equal(await count(), 5);
  await button("↷ Redo").click();
  assert.equal(await count(), 6);

  // Editing a step replaces it in place instead of appending.
  const second = page.locator(".move:not(.empty)").nth(1);
  const before = await second.textContent();
  await second.click();
  await page.locator("#body-part").selectOption("head");
  await page.locator("#angle").fill("30");
  await button("✓ Update move 2").click();
  assert.equal(await count(), 6);
  assert.notEqual(await second.textContent(), before);
  assert.match(await second.textContent(), /Head/);

  await button("Save, load and import").click();
  await button("♡ Save dance").click();
  await button("Clear").click();
  assert.equal(await count(), 0);
  await button("Save, load and import").click();
  await button("↥ Load saved dance").click();
  await page.locator(".move:not(.empty)").first().waitFor();
  assert.equal(await count(), 6);
  await button("Share ↗").click();
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
  await button("Save, load and import").click();
  await button("Import a dance code ↗").click();
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
  await button("Today’s challenge").click();
  await page.locator("#daily-dialog").getByRole("heading").waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();

  // Phone, small phone, and a short Reddit post: still one screen.
  for (const [width, height] of [
    [390, 844],
    [360, 640],
    [640, 480],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    assert.equal(await fitsOneScreen(), true, `${width}x${height} fits`);
    await page.screenshot({ path: `../studio-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../studio-mobile.png" });
  await button("Tune").click();
  await page.locator("#angle").waitFor({ state: "visible" });
  assert.equal(await fitsOneScreen(), true, "phone with Tune open fits");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: one screen at 5 sizes, playback, undo/redo, step editing, save/load, character choice, recording, invalid/valid import, share code, daily dialog. No page errors.",
  );
} finally {
  if (browser) await browser.close();
  server.kill();
}
