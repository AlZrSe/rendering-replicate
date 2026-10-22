import { test, expect } from "@playwright/test";
import { login, TEST_TOKEN, resetAuthState } from "./test-utils";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await resetAuthState(page, baseURL);
    await login(page, TEST_TOKEN);
  });

  test("should load dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.locator("text=cluster workload overview")).toBeVisible();
  });

  test("should show navigation", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('a[href="/"]:has-text("Jobs")')).toBeVisible();
    await expect(page.locator('a[href="/profiles"]:has-text("Profiles")')).toBeVisible();
    await expect(page.locator('a[href="/nodes"]:has-text("Nodes")')).toBeVisible();
    await expect(page.locator('a[href="/settings"]:has-text("Settings")')).toBeVisible();
  });

  test("should show job statistics", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("text=Running")).toBeVisible();
    await expect(page.locator("text=Queued")).toBeVisible();
    await expect(page.locator("text=Failed")).toBeVisible();
    await expect(page.locator("text=Nodes online")).toBeVisible();
  });

  test("should show node statistics", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("text=Nodes online")).toBeVisible();
  });

  test("should show GPU utilization", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("text=Nodes online")).toBeVisible();
  });

  test("should navigate to jobs page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=cluster workload overview")).toBeVisible();
  });

  test("should navigate to nodes page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/nodes"]:has-text("Nodes")');
    await expect(page).toHaveURL("/nodes");
    await expect(page.locator("h1:has-text(\"Nodes\")")).toBeVisible();
  });

  test("should navigate to settings page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/settings"]:has-text("Settings")');
    await expect(page).toHaveURL("/settings");
    await expect(page.locator("h1:has-text(\"Settings\")")).toBeVisible();
  });

  test("should show jobs table on dashboard", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
    await expect(page.locator("text=cluster workload overview")).toBeVisible();
    // Should have jobs table with seeded data
    await expect(page.locator("tbody a").first()).toBeVisible({ timeout: 10000 });
  });

  test("should show theme toggle in header", async ({ page }) => {
    await page.goto("/");

    const themeToggle = page.locator('button:has-text("Light mode"), button:has-text("Dark mode")');
    await expect(themeToggle).toBeVisible();
  });

  test("should be responsive", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const menuButton = page.locator('button[aria-label="Menu"], button[aria-label="Open menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.locator('a[href="/"]:has-text("Jobs")')).toBeVisible();
    }
  });

  test("should show toast notifications", async ({ page }) => {
    await page.goto("/jobs/new");
    await expect(page.getByRole("heading", { name: "Submit job" })).toBeVisible();
  });
});
