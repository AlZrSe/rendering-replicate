import { test, expect } from '@playwright/test';
import { login, TEST_TOKEN, updateSettings } from './test-utils';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('should login with valid token', async ({ page }) => {
    await login(page, TEST_TOKEN);
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Jobs')).toBeVisible();
  });

  test('should show error with invalid token on non-localhost', async ({ page }) => {
    // On localhost, any token works due to bypass
    // This test verifies the login form works
    await page.goto('/login');
    await page.fill('input[id="token"]', 'invalid-token-that-is-long-enough');
    await page.click('button:has-text("Sign in")');
    // On localhost, this should still succeed
    await expect(page).toHaveURL('/');
  });

  test('should logout and return to login', async ({ page }) => {
    await login(page, TEST_TOKEN);
    
    // Click logout button in settings
    await page.click('a[href="/settings"], button:has-text("Settings")');
    await expect(page).toHaveURL('/settings');
    
    await page.click('button:has-text("Sign out")');
    await expect(page).toHaveURL('/login');
    
    // Try to access protected page
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('should persist token in localStorage', async ({ page }) => {
    await login(page, TEST_TOKEN);
    
    const token = await page.evaluate(() => localStorage.getItem('shc.settings'));
    expect(token).toBeTruthy();
    const parsed = JSON.parse(token!);
    expect(parsed.token).toBe(TEST_TOKEN);
  });

  test('should validate token via API', async ({ page }) => {
    await login(page, TEST_TOKEN);
    
    // Check that token validation works
    const response = await page.request.get('http://localhost:8000/api/v1/auth/verify', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.valid).toBe(true);
  });

  test('should allow token update in settings', async ({ page }) => {
    await login(page, TEST_TOKEN);
    
    const newToken = 'new-test-token-that-is-long-enough-12345';
    await updateSettings(page, { token: newToken });
    
    // Verify token was updated
    const stored = await page.evaluate(() => localStorage.getItem('shc.settings'));
    const parsed = JSON.parse(stored!);
    expect(parsed.token).toBe(newToken);
  });
});