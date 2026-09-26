import { test, expect } from '@playwright/test';
import { login, TEST_TOKEN } from './test-utils';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await login(page, TEST_TOKEN);
  });

  test('should load dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Scientific Home Cluster')).toBeVisible();
  });

  test('should show navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check main navigation items
    await expect(page.locator('a[href="/"]:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('a[href="/jobs"]:has-text("Jobs")')).toBeVisible();
    await expect(page.locator('a[href="/nodes"]:has-text("Nodes")')).toBeVisible();
    await expect(page.locator('a[href="/settings"]:has-text("Settings")')).toBeVisible();
  });

  test('should show job statistics', async ({ page }) => {
    await page.goto('/');
    
    // Should show job counts
    await expect(page.locator('text=Total Jobs')).toBeVisible();
    await expect(page.locator('text=Running')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    await expect(page.locator('text=Failed')).toBeVisible();
  });

  test('should show node statistics', async ({ page }) => {
    await page.goto('/');
    
    // Should show node counts
    await expect(page.locator('text=Total Nodes')).toBeVisible();
    await expect(page.locator('text=Online')).toBeVisible();
    await expect(page.locator('text=Offline')).toBeVisible();
  });

  test('should show GPU utilization', async ({ page }) => {
    await page.goto('/');
    
    // Should show GPU stats
    await expect(page.locator('text=GPU Utilization')).toBeVisible();
  });

  test('should navigate to jobs page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/jobs"]:has-text("Jobs")');
    await expect(page).toHaveURL('/jobs');
    await expect(page.locator('text=Jobs')).toBeVisible();
  });

  test('should navigate to nodes page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/nodes"]:has-text("Nodes")');
    await expect(page).toHaveURL('/nodes');
    await expect(page.locator('text=Nodes')).toBeVisible();
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/settings"]:has-text("Settings")');
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should show recent jobs on dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Should show recent jobs list
    await expect(page.locator('text=Recent Jobs')).toBeVisible();
  });

  test('should show theme toggle in header', async ({ page }) => {
    await page.goto('/');
    
    // Theme toggle should be in header
    const themeToggle = page.locator('header button[role="switch"]');
    await expect(themeToggle).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Mobile menu should be accessible
    const menuButton = page.locator('button[aria-label="Menu"], button[aria-label="Open menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.locator('a[href="/jobs"]:has-text("Jobs")')).toBeVisible();
    }
  });

  test('should show toast notifications', async ({ page }) => {
    await page.goto('/');
    
    // Trigger a toast by doing an action that generates one
    // (e.g., invalid action)
    await page.goto('/jobs/new');
    await page.click('button:has-text("Create job")');
    
    // Should show validation error toast
    await expect(page.locator('[role="alert"], .toast')).toBeVisible({ timeout: 5000 });
  });
});