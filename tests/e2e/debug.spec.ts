import { test, expect } from "@playwright/test";

test.describe("Debug - runs first to diagnose failures", () => {
  test("dump page state on dashboard", async ({ page }, testInfo) => {
    await page.goto("/");

    // Wait a bit for React to hydrate
    await page.waitForTimeout(3000);

    // Capture full page HTML
    const html = await page.content();
    await testInfo.attach("page-html", { body: html, contentType: "text/html" });

    // Take screenshot
    await testInfo.attach("screenshot", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Log console errors
    const logs = [];
    page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
    page.on("pageerror", (err) => logs.push(`ERROR: ${err.message}`));

    await testInfo.attach("console-logs", { body: logs.join("\n"), contentType: "text/plain" });

    // Check what's actually rendered
    const bodyText = await page.locator("body").innerText();
    await testInfo.attach("body-text", { body: bodyText, contentType: "text/plain" });

    // Always pass - this is diagnostic
    expect(true).toBe(true);
  });
});
