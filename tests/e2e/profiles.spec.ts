import { test, expect } from "@playwright/test";
import { login, TEST_TOKEN, uniqueName, resetAuthState } from "./test-utils";

test.describe("Profiles", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await resetAuthState(page, baseURL);
    await login(page, TEST_TOKEN);
  });

  test("should list built-in profiles", async ({ page }) => {
    await page.goto("/profiles");
    await expect(page).toHaveURL("/profiles");

    await expect(page.getByRole("heading", { name: "VASP — standard relaxation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "LAMMPS — molecular dynamics (GPU)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "GROMACS — mdrun" })).toBeVisible();
  });

  test("should show profile details", async ({ page }) => {
    await page.goto("/profiles");

    await page.click('a:has-text("Edit")');
    await expect(page).toHaveURL(/\/profiles\/.+/);
    await expect(page.getByRole("heading", { name: "VASP — standard relaxation" })).toBeVisible();
  });

  test("should create new profile", async ({ page }) => {
    await page.goto("/profiles/new");
    await expect(page).toHaveURL("/profiles/new");

    const profileName = uniqueName("custom-profile");
    await page.fill("#pname", profileName);
    await page.fill("#software", "Custom Software");
    await page.fill("#desc", "A custom test profile");
    await page.fill("#cmd", "custom-command --flag");
    await page.fill("#wd", "/custom/path");

    await page.click('button:has-text("Create profile")');

    await expect(page).toHaveURL("/profiles");
    await expect(page.locator(`text=${profileName}`)).toBeVisible();
  });

  test("should create job from profile", async ({ page }) => {
    await page.goto("/profiles");

    await page.click('a:has-text("Use profile")');
    await expect(page).toHaveURL(/\/jobs\/new/);
  });

  test("should validate profile form", async ({ page }) => {
    await page.goto("/profiles/new");
    await expect(page.getByRole("heading", { name: "New profile" })).toBeVisible();
  });

  test("should restore built-in profiles", async ({ page }) => {
    await page.goto("/profiles");
    await expect(page.locator('button:has-text("Restore defaults")')).toBeVisible();
  });
});
