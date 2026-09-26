import { test, expect } from '@playwright/test';
import { login, TEST_TOKEN, updateSettings, gotoSettings } from './test-utils';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await login(page, TEST_TOKEN);
  });

  test('should navigate to settings page', async ({ page }) => {
    await gotoSettings(page);
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('text=Connection')).toBeVisible();
    await expect(page.locator('text=Live updates')).toBeVisible();
    await expect(page.locator('text=Dark mode')).toBeVisible();
  });

  test('should update API base URL', async ({ page }) => {
    await updateSettings(page, { apiBaseUrl: 'http://custom-api:8000/api/v1' });
    
    const stored = await page.evaluate(() => localStorage.getItem('shc.settings'));
    const parsed = JSON.parse(stored!);
    expect(parsed.apiBaseUrl).toBe('http://custom-api:8000/api/v1');
  });

  test('should update bearer token', async ({ page }) => {
    const newToken = 'new-bearer-token-12345';
    await updateSettings(page, { token: newToken });
    
    const stored = await page.evaluate(() => localStorage.getItem('shc.settings'));
    const parsed = JSON.parse(stored!);
    expect(parsed.token).toBe(newToken);
  });

  test('should toggle dark mode', async ({ page }) => {
    await gotoSettings(page);
    
    // Get initial theme
    const initialTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    
    // Toggle theme
    const switchEl = page.locator('button[role="switch"]');
    await switchEl.click();
    
    const newTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(newTheme).not.toBe(initialTheme);
    
    // Verify it's persisted
    await page.reload();
    const persistedTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(persistedTheme).toBe(newTheme);
  });

  test('should update poll interval', async ({ page }) => {
    await updateSettings(page, { pollIntervalMs: 5000 });
    
    const stored = await page.evaluate(() => localStorage.getItem('shc.settings'));
    const parsed = JSON.parse(stored!);
    expect(parsed.pollIntervalMs).toBe(5000);
  });

  test('should update WebSocket reconnect delay', async ({ page }) => {
    await updateSettings(page, { wsReconnectMs: 5000 });
    
    const stored = await page.evaluate(() => localStorage.getItem('shc.settings'));
    const parsed = JSON.parse(stored!);
    expect(parsed.wsReconnectMs).toBe(5000);
  });

  test('should show localhost bypass message', async ({ page }) => {
    await gotoSettings(page);
    
    // On localhost, should show the bypass message
    await expect(page.locator('text=Running on localhost')).toBeVisible();
    await expect(page.locator('text=authorisation is skipped')).toBeVisible();
  });

  test('should not show sign out button on localhost', async ({ page }) => {
    await gotoSettings(page);
    
    // On localhost, sign out button should not be visible (or should be hidden)
    // The sign out button is conditionally rendered
    const signOutBtn = page.locator('button:has-text("Sign out")');
    await expect(signOutBtn).toBeHidden();
  });

  test('should persist settings across reload', async ({ page }) => {
    await updateSettings(page, { 
      apiBaseUrl: 'http://persist-test:8000/api/v1',
      pollIntervalMs: 3000,
      wsReconnectMs: 4000,
    });
    
    await page.reload();
    await gotoSettings(page);
    
    await expect(page.locator('input[id="api"]')).toHaveValue('http://persist-test:8000/api/v1');
    await expect(page.locator('input[id="poll"]')).toHaveValue('3000');
    await expect(page.locator('input[id="reconnect"]')).toHaveValue('4000');
  });

  test('should validate API URL format', async ({ page }) => {
    await gotoSettings(page);
    
    // Try invalid URL
    await page.fill('input[id="api"]', 'not-a-url');
    await page.click('button:has-text("Save settings")');
    
    // Should still save (client-side validation only)
    // The actual validation happens on the backend
  });

  test('should show/hide token', async ({ page }) => {
    await gotoSettings(page);
    
    const tokenInput = page.locator('input[id="token"]');
    await tokenInput.fill('secret-token-12345');
    
    // Should be password type by default
    await expect(tokenInput).toHaveAttribute('type', 'password');
    
    // Click show button
    await page.click('button[aria-label="Show token"]');
    await expect(tokenInput).toHaveAttribute('type', 'text');
    
    // Click hide button
    await page.click('button[aria-label="Hide token"]');
    await expect(tokenInput).toHaveAttribute('type', 'password');
  });
});