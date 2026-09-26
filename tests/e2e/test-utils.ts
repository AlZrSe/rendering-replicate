import { Page, Locator, expect } from '@playwright/test';

export const TEST_TOKEN = 'localhost-no-auth';
export const TEST_API_URL = 'http://localhost:8000/api/v1';

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
  name: 'e2e-test-job',
  command: 'echo "hello world" && sleep 2',
  working_dir: '/tmp/e2e-test',
  gpus: 0,
  cpus: 2,
  memory_gb: 4,
  vram_gb: 0,
  env: {},
  input: 'data/in',
  output: 'data/out',
  max_retries: 1,
  retry_delay_seconds: 30,
};

export async function login(page: Page, token: string = TEST_TOKEN) {
  await page.goto('/login');
  await page.fill('input[id="token"]', token);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL('/');
}

export async function gotoSettings(page: Page) {
  await page.click('a[href="/settings"], button:has-text("Settings")');
  await expect(page).toHaveURL('/settings');
}

export async function updateSettings(page: Page, settings: Partial<{ apiBaseUrl: string; token: string; theme: string; pollIntervalMs: number; wsReconnectMs: number }>) {
  await gotoSettings(page);
  
  if (settings.apiBaseUrl) {
    await page.fill('input[id="api"]', settings.apiBaseUrl);
  }
  if (settings.token) {
    await page.fill('input[id="token"]', settings.token);
  }
  if (settings.pollIntervalMs) {
    await page.fill('input[id="poll"]', String(settings.pollIntervalMs));
  }
  if (settings.wsReconnectMs) {
    await page.fill('input[id="reconnect"]', String(settings.wsReconnectMs));
  }
  if (settings.theme) {
    const isDark = settings.theme === 'dark';
    const switchEl = page.locator('button[role="switch"]');
    const checked = await switchEl.isChecked();
    if (checked !== isDark) {
      await switchEl.click();
    }
  }
  await page.click('button:has-text("Save settings")');
  await expect(page.locator('text=Settings saved')).toBeVisible();
}

export async function createJob(page: Page, job: JobData = defaultJob) {
  await page.click('a[href="/jobs/new"], button:has-text("New Job")');
  await expect(page).toHaveURL('/jobs/new');

  await page.fill('input[name="name"]', job.name);
  await page.fill('textarea[name="command"]', job.command);
  await page.fill('input[name="working_dir"]', job.working_dir);
  await page.fill('input[name="gpus"]', String(job.gpus));
  await page.fill('input[name="cpus"]', String(job.cpus));
  await page.fill('input[name="memory_gb"]', String(job.memory_gb));
  
  if (job.vram_gb !== undefined) {
    await page.fill('input[name="vram_gb"]', String(job.vram_gb));
  }
  
  if (job.input) {
    await page.fill('input[name="input"]', job.input);
  }
  if (job.output) {
    await page.fill('input[name="output"]', job.output);
  }
  if (job.max_retries !== undefined) {
    await page.fill('input[name="max_retries"]', String(job.max_retries));
  }
  if (job.retry_delay_seconds !== undefined) {
    await page.fill('input[name="retry_delay_seconds"]', String(job.retry_delay_seconds));
  }

  await page.click('button:has-text("Create job")');
  
  // Wait for redirect to job detail page
  await page.waitForURL(/\/jobs\/job-\d+/);
  
  const jobId = page.url().match(/\/jobs\/(job-\d+)/)?.[1];
  return jobId;
}

export async function waitForJobStatus(page: Page, jobId: string, expectedStatus: string, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const response = await page.request.get(`${TEST_API_URL}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    if (response.ok()) {
      const job = await response.json();
      if (job.status === expectedStatus) {
        return job;
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`Job ${jobId} did not reach status ${expectedStatus} within ${timeout}ms`);
}

export async function cancelJob(page: Page, jobId: string) {
  const response = await page.request.post(`${TEST_API_URL}/jobs/${jobId}/cancel`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export async function retryJob(page: Page, jobId: string) {
  const response = await page.request.post(`${TEST_API_URL}/jobs/${jobId}/retry`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export async function deleteJob(page: Page, jobId: string) {
  const response = await page.request.delete(`${TEST_API_URL}/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.status();
}

export async function getJobLogs(page: Page, jobId: string) {
  const response = await page.request.get(`${TEST_API_URL}/jobs/${jobId}/logs/history`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export async function getJobMetrics(page: Page, jobId: string) {
  const response = await page.request.get(`${TEST_API_URL}/jobs/${jobId}/metrics`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export async function getNodes(page: Page) {
  const response = await page.request.get(`${TEST_API_URL}/nodes`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export async function getNodeMetrics(page: Page, nodeId: string) {
  const response = await page.request.get(`${TEST_API_URL}/nodes/${nodeId}/metrics`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  return response.json();
}

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}