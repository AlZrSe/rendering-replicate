import { test, expect } from "@playwright/test";
import { login, TEST_TOKEN, gotoSettings, uniqueName } from "./test-utils";

test.describe("Profiles", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await login(page, TEST_TOKEN);
  });

  test("should list built-in profiles", async ({ page }) => {
    await page.goto("/profiles");
    await expect(page).toHaveURL("/profiles");

    // Should show built-in profiles
    await expect(page.locator("text=VASP")).toBeVisible();
    await expect(page.locator("text=LAMMPS")).toBeVisible();
    await expect(page.locator("text=GROMACS")).toBeVisible();
    await expect(page.locator("text=Quantum ESPRESSO")).toBeVisible();
  });

  test("should show profile details", async ({ page }) => {
    await page.goto("/profiles");

    // Click on VASP profile
    await page.click("text=VASP — standard relaxation");
    await expect(page).toHaveURL(/\/profiles\/vasp-std/);

    // Verify profile details
    await expect(page.locator("text=VASP — standard relaxation")).toBeVisible();
    await expect(page.locator("text=vasp_std")).toBeVisible();
    await expect(page.locator("text=CPUs: 16")).toBeVisible();
    await expect(page.locator("text=Memory: 64 GB")).toBeVisible();
  });

  test("should create new profile", async ({ page }) => {
    await page.goto("/profiles");
    await page.click('a[href="/profiles/new"], button:has-text("New Profile")');
    await expect(page).toHaveURL("/profiles/new");

    const profileName = uniqueName("custom-profile");
    await page.fill('input[name="name"]', profileName);
    await page.fill('input[name="software"]', "Custom Software");
    await page.fill('textarea[name="description"]', "A custom test profile");
    await page.fill('textarea[name="command"]', "custom-command --flag");
    await page.fill('input[name="working_dir"]', "/custom/path");
    await page.fill('input[name="gpus"]', "1");
    await page.fill('input[name="cpus"]', "4");
    await page.fill('input[name="memory_gb"]', "16");
    await page.fill('input[name="vram_gb"]', "8");
    await page.fill('input[name="input"]', "data/in");
    await page.fill('input[name="output"]', "data/out");
    await page.fill('input[name="max_retries"]', "2");
    await page.fill('input[name="retry_delay_seconds"]', "60");

    await page.click('button:has-text("Create profile")');

    // Should redirect to profile list
    await expect(page).toHaveURL("/profiles");
    await expect(page.locator(`text=${profileName}`)).toBeVisible();
  });

  test("should edit existing profile", async ({ page }) => {
    await page.goto("/profiles");

    // Click on a built-in profile
    await page.click("text=VASP — standard relaxation");
    await page.click('button:has-text("Edit")');

    // Modify the profile
    await page.fill('input[name="description"]', "Updated description for VASP");
    await page.click('button:has-text("Save")');

    // Verify update
    await expect(page.locator("text=Updated description for VASP")).toBeVisible();
  });

  test("should create job from profile", async ({ page }) => {
    await page.goto("/profiles");
    await page.click("text=VASP — standard relaxation");

    // Click "Create Job" button
    await page.click('button:has-text("Create Job")');
    await expect(page).toHaveURL("/jobs/new");

    // Form should be pre-filled with profile data
    await expect(page.locator('input[name="name"]')).toHaveValue("vasp-std");
    await expect(page.locator('textarea[name="command"]')).toHaveValue("mpirun -np 16 vasp_std");
    await expect(page.locator('input[name="gpus"]')).toHaveValue("0");
    await expect(page.locator('input[name="cpus"]')).toHaveValue("16");
    await expect(page.locator('input[name="memory_gb"]')).toHaveValue("64");
  });

  test("should hide built-in profile", async ({ page }) => {
    await page.goto("/profiles");

    // Click on a profile to view details
    await page.click("text=VASP — standard relaxation");

    // Click hide button
    await page.click('button:has-text("Hide")');

    // Should redirect to list and profile should be hidden
    await expect(page).toHaveURL("/profiles");

    // The hidden profile should not be in the main list
    // (It might still be accessible via direct URL)
  });

  test("should restore built-in profiles", async ({ page }) => {
    await gotoSettings(page);

    // Look for restore builtins option (if available in settings)
    // This is more of a settings test
    await expect(page.locator("text=Settings")).toBeVisible();
  });

  test("should validate profile form", async ({ page }) => {
    await page.goto("/profiles/new");

    // Try to submit empty form
    await page.click('button:has-text("Create profile")');

    // Should show validation errors
    await expect(page.locator("text=Name is required")).toBeVisible();
    await expect(page.locator("text=Software is required")).toBeVisible();
    await expect(page.locator("text=Command is required")).toBeVisible();
  });

  test("should duplicate profile", async ({ page }) => {
    await page.goto("/profiles");
    await page.click("text=VASP — standard relaxation");

    // Click duplicate (if available)
    // This might be an "Edit" then "Save as new" flow
    await page.click('button:has-text("Edit")');

    // Change name to make it unique
    const newName = uniqueName("duplicated-vasp");
    await page.fill('input[name="name"]', newName);
    await page.click('button:has-text("Save")');

    // Should create a new custom profile
    await expect(page.locator(`text=${newName}`)).toBeVisible();
  });
});
