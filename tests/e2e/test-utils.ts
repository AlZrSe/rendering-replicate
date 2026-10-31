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
  await page.goto("/login");
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
 * The fix: clear localStorage ONCE via an init script that runs on the initial
 * about:blank page, then navigate to /login. Subsequent navigations must NOT
 * clear localStorage again, or the Shell's redirect logic will see a cleared
 * state and bounce the user back to /login (issue #150).
 */
export async function resetAuthState(page: Page, baseURL?: string): Promise<void> {
  await page.context().clearCookies();

  // Clear localStorage ONCE on the initial about:blank page, before any navigation.
  // The init script runs on every navigation, so we only clear if we're on about:blank.
  await page.addInitScript(() => {
    // Only clear on the initial about:blank page, not on subsequent navigations
    if (window.location.href === "about:blank") {
      try {
        localStorage.clear();
        localStorage.removeItem("shc.authenticated");
      } catch {
        // Ignore SecurityError on about:blank
      }
    }
    // Capture console errors for debugging
    const w = window as unknown as { __consoleMessages: Array<{ type: string; args: string[] }> };
    w.__consoleMessages = [];
    const origError = console.error;
    console.error = (...args: (string | number | boolean | null | undefined)[]) => {
      w.__consoleMessages.push({ type: "error", args: args.map(String) });
      origError.apply(console, args);
    };
    const origWarn = console.warn;
    console.warn = (...args: (string | number | boolean | null | undefined)[]) => {
      w.__consoleMessages.push({ type: "warn", args: args.map(String) });
      origWarn.apply(console, args);
    };
  });

  // Navigate directly to /login (not relying on Shell redirect which may not fire in time)
  // Wait for networkidle to ensure all JS bundles are loaded and React has hydrated
  await page.goto("/login", { waitUntil: "networkidle" });

  // Wait for the login form to be visible
  try {
    await page.waitForSelector('input[id="sharedToken"]', { timeout: 30000 });
  } catch (e) {
    // Debug: capture page content when login form doesn't appear
    const html = await page.content();
    console.log("PAGE HTML ON FAILURE:", html.substring(0, 5000));
    const consoleMessages = await page.evaluate(() => {
      const w = window as unknown as {
        __consoleMessages?: Array<{ type: string; args: string[] }>;
      };
      return w.__consoleMessages || [];
    });
    console.log("CONSOLE MESSAGES:", JSON.stringify(consoleMessages));
    throw e;
  }
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
  name: string;
  status: string;
  spec: unknown;
  created_at: string;
  retry_count: number;
  exit_code?: number | null;
  error?: string | null;
}

export async function waitForJobStatus(
  page: Page,
  jobId: string,
  expectedStatus: string,
  timeout = 30000,
): Promise<JobResponse> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const response = await page.request.get(`${TEST_API_URL}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    if (response.ok()) {
      const job = await response.json();
      if (job.status === expectedStatus) {
        return job as JobResponse;
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`Job ${jobId} did not reach status ${expectedStatus} within ${timeout}ms`);
}

export async function cancelJob(page: Page, jobId: string): Promise<JobResponse> {
  const response = await page.request.post(`${TEST_API_URL}/jobs/${jobId}/cancel`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export async function retryJob(page: Page, jobId: string): Promise<JobResponse> {
  const response = await page.request.post(`${TEST_API_URL}/jobs/${jobId}/retry`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export async function deleteJob(page: Page, jobId: string): Promise<number> {
  const response = await page.request.delete(`${TEST_API_URL}/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.status();
}

export async function getJobLogs(page: Page, jobId: string): Promise<string[]> {
  const response = await page.request.get(`${TEST_API_URL}/jobs/${jobId}/logs/history`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export async function getJobMetrics(page: Page, jobId: string): Promise<unknown> {
  const response = await page.request.get(`${TEST_API_URL}/jobs/${jobId}/metrics`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface NodeResponse {
  node_id: string;
  name: string;
  status: string;
  gpus: unknown[];
  resources: unknown;
  spec: unknown;
  created_at: string;
  updated_at: string;
}

export async function getNodes(page: Page): Promise<NodeResponse[]> {
  const response = await page.request.get(`${TEST_API_URL}/nodes/`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export async function getNodeMetrics(page: Page, nodeId: string): Promise<NodeMetricsResponse> {
  const response = await page.request.get(`${TEST_API_URL}/nodes/${nodeId}/metrics`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export interface NodeMetricsResponse {
  job_id: string;
  gpu_metrics: Array<{
    timestamp: string;
    gpu_id: number;
    memory_used_mb: number;
    memory_total_mb: number;
    utilization_percent: number;
  }>;
  cpu_metrics: Array<{
    timestamp: string;
    cpu_id: number;
    utilization_percent: number;
  }>;
  summary: {
    gpu_memory_avg_mb: number;
    gpu_utilization_avg_percent: number;
    cpu_avg_percent: number;
  };
}
