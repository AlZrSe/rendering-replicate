import { Page, Locator, expect } from "@playwright/test";

// Issue #31: this suite depends on `localhost` being a bypass host on BOTH
// sides, so the token below is never actually validated - the backend sees
// `Host: localhost` from Playwright, `is_localhost()` returns true, and the
// request proceeds with `{"sub": "localhost_user"}`. Change the token and the
// suite stops testing the bypass and starts testing token validation.
//
// The shared list of bypass hosts is `shared/auth/localhost_hosts.json` in the
// parent repository (`backend/core/utils.py` and `src/lib/settings.ts` each
// keep a literal copy of their half of it; issue #31 aligned them).
export const TEST_TOKEN = "localhost-no-auth";
export const TEST_API_URL = "http://localhost:8000/api/v1";

export interface JobData {
  name: string;
  command: string;
  working_dir: string;
  gpus: number;
  cpus: number;
  memory_gb: number;
  vram_gb?: number;
  env?: Record<string, string>;
  input?: string;
  output?: string;
  max_retries?: number;
  retry_delay_seconds?: number;
}

export const defaultJob: JobData = {
  name: "e2e-test-job",
  command: 'echo "hello world" && sleep 2',
  working_dir: "/tmp/e2e-test",
  gpus: 0,
  cpus: 2,
  memory_gb: 4,
  vram_gb: 0,
  env: {},
  input: "data/in",
  output: "data/out",
  max_retries: 1,
  retry_delay_seconds: 30,
};

/**
 * Log in using the test token. On all hosts (including bypass hosts),
 * we now drive the actual login form since the login form renders on
 * all hosts. The bypass token `localhost-no-auth` is accepted by the
 * backend on bypass hosts.
 */
export async function login(page: Page, token: string = TEST_TOKEN): Promise<void> {
  // If not already on the login page, navigate there
  if (!page.url().endsWith("/login")) {
    await page.goto("/login");
  }
  await page.waitForSelector('input[id="sharedToken"]', { timeout: 30000 });
  await page.fill('input[id="sharedToken"]', token);
  await page.click('button:has-text("Connect")');
  await expect(page).toHaveURL("/");
}

/**
 * Start a test from a known-empty browser: no cookies, no localStorage.
 *
 * Issue #141. Every spec used to do this inline in a `beforeEach`, as
 * `page.evaluate(() => localStorage.clear())` BEFORE the test's own first
 * `page.goto`. A Playwright page starts on `about:blank`, whose origin is
 * opaque, so `localStorage` on it throws:
 *
 *     SecurityError: Failed to read the 'localStorage' property from
 *     'Window': Access is denied for this document.
 *
 * That is a property of *when* the evaluate runs, not of which origin the suite
 * points at, so it failed identically against the vite dev server on :5173 and
 * against a compose stack on :8000. Nothing about the arrangement was the cause,
 * and nothing about the origin is assumed here: the navigation uses whatever
 * `baseURL` the run is configured with.
 *
 * We navigate directly to /login with domcontentloaded, then clear localStorage
 * using page.evaluate(). This avoids the SecurityError on about:blank while
 * ensuring the login form renders.
 */
export async function resetAuthState(page: Page, baseURL?: string): Promise<void> {
  await page.context().clearCookies();
  // Navigate directly to /login with domcontentloaded (not full load)
  // so we can clear localStorage before React hydrates
  await page.goto((baseURL ?? "") + "/login", { waitUntil: "domcontentloaded" });
  // Clear localStorage after navigation but before React hydration
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.removeItem("shc.loggedOut");
  });
  // Wait for the login form to be visible
  await page.waitForSelector('input[id="sharedToken"]', { timeout: 30000 });
}

export async function gotoSettings(page: Page) {
  await page.click('a[href="/settings"], button:has-text("Settings")');
  await expect(page).toHaveURL("/settings");
}

export async function updateSettings(
  page: Page,
  settings: Partial<{
    apiBaseUrl: string;
    theme: string;
    pollIntervalMs: number;
    wsReconnectMs: number;
  }>,
) {
  await gotoSettings(page);

  if (settings.apiBaseUrl) {
    await page.fill('input[id="api"]', settings.apiBaseUrl);
  }
  if (settings.pollIntervalMs) {
    await page.fill('input[id="poll"]', String(settings.pollIntervalMs));
  }
  if (settings.wsReconnectMs) {
    await page.fill('input[id="reconnect"]', String(settings.wsReconnectMs));
  }
  if (settings.theme) {
    const isDark = settings.theme === "dark";
    const switchEl = page.locator('button[role="switch"]');
    const checked = await switchEl.isChecked();
    if (checked !== isDark) {
      await switchEl.click();
    }
  }
  await page.click('button:has-text("Save settings")');
  await expect(page.locator("text=Settings saved")).toBeVisible();
}

export async function createJob(page: Page, job: JobData = defaultJob): Promise<string> {
  await page.goto("/");
  await expect(page.locator('a[href="/jobs/new"]')).toBeVisible({ timeout: 15000 });
  await page.click('a[href="/jobs/new"]');
  await expect(page).toHaveURL("/jobs/new");

  await page.fill("#name", job.name);
  await page.fill("#command", job.command);
  await page.fill("#working_dir", job.working_dir);
  await page.fill("#gpus", String(job.gpus));
  await page.fill("#cpus", String(job.cpus));
  await page.fill("#memory_gb", String(job.memory_gb));

  if (job.vram_gb !== undefined) {
    await page.fill("#vram_gb", String(job.vram_gb));
  }

  if (job.input) {
    await page.fill("#input", job.input);
  }
  if (job.output) {
    await page.fill("#output", job.output);
  }
  if (job.max_retries !== undefined) {
    await page.fill("#max_retries", String(job.max_retries));
  }
  if (job.retry_delay_seconds !== undefined) {
    await page.fill("#retry_delay_seconds", String(job.retry_delay_seconds));
  }

  await page.click('button:has-text("Submit job")');

  // Wait for redirect to job detail page
  await page.waitForURL(/\/jobs\/job-\d+/);

  const match = page.url().match(/\/jobs\/(job-\d+)/);
  if (!match) throw new Error("Job ID not found in URL after creation");
  return match[1] as string;
}

export interface JobResponse {
  job_id: string;
}