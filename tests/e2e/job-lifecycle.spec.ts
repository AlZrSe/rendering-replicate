import { test, expect } from '@playwright/test';
import { 
  login, 
  TEST_TOKEN, 
  createJob, 
  waitForJobStatus, 
  cancelJob, 
  retryJob, 
  deleteJob,
  getJobLogs,
  getJobMetrics,
  defaultJob,
  uniqueName
} from './test-utils';

test.describe('Job Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await login(page, TEST_TOKEN);
  });

  test('should create a new job', async ({ page }) => {
    const jobName = uniqueName('test-job');
    const jobData = { ...defaultJob, name: jobName };
    
    const jobId = await createJob(page, jobData);
    expect(jobId).toMatch(/^job-\d+$/);
    
    // Verify job appears in list
    await page.goto('/');
    await expect(page.locator(`text=${jobName}`)).toBeVisible();
  });

  test('should show job details', async ({ page }) => {
    const jobName = uniqueName('detail-test');
    const jobId = await createJob(page, { ...defaultJob, name: jobName });
    
    // Navigate to job detail
    await page.click(`a[href="/jobs/${jobId}"]`);
    await expect(page).toHaveURL(`/jobs/${jobId}`);
    
    // Verify job details are shown
    await expect(page.locator(`text=${jobName}`)).toBeVisible();
    await expect(page.locator('text=PENDING')).toBeVisible();
    await expect(page.locator(`text=${defaultJob.command}`)).toBeVisible();
  });

  test('should show job logs', async ({ page }) => {
    const jobName = uniqueName('logs-test');
    const jobId = await createJob(page, { ...defaultJob, name: jobName });
    
    await page.goto(`/jobs/${jobId}`);
    
    // Click logs tab or wait for logs to load
    await expect(page.locator('text=Logs')).toBeVisible();
    await page.click('text=Logs');
    
    // Wait for logs to load
    await expect(page.locator('text=job accepted by scheduler')).toBeVisible({ timeout: 10000 });
  });

  test('should show job metrics', async ({ page }) => {
    const jobName = uniqueName('metrics-test');
    const jobId = await createJob(page, { ...defaultJob, name: jobName });
    
    await page.goto(`/jobs/${jobId}`);
    
    // Click metrics tab
    await page.click('text=Metrics');
    
    // Wait for metrics to load
    await expect(page.locator('text=GPU Memory')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=GPU Utilization')).toBeVisible();
    await expect(page.locator('text=CPU Usage')).toBeVisible();
  });

  test('should cancel a pending job', async ({ page }) => {
    const jobName = uniqueName('cancel-test');
    const jobId = await createJob(page, { ...defaultJob, name: jobName });
    
    // Wait for job to be in PENDING or RUNNING
    await waitForJobStatus(page, jobId, 'PENDING');
    
    // Cancel the job
    await page.goto(`/jobs/${jobId}`);
    await page.click('button:has-text("Cancel")');
    await page.click('button:has-text("Confirm")');
    
    // Verify job is cancelled
    const cancelledJob = await waitForJobStatus(page, jobId, 'CANCELLED');
    expect(cancelledJob.status).toBe('CANCELLED');
    expect(cancelledJob.exit_code).toBe(-1);
  });

  test('should retry a failed job', async ({ page }) => {
    const jobName = uniqueName('retry-test');
    const jobId = await createJob(page, { ...defaultJob, name: jobName });
    
    // Cancel first to make it retryable (or wait for failure)
    await cancelJob(page, jobId);
    await waitForJobStatus(page, jobId, 'CANCELLED');
    
    // Retry the job
    const retriedJob = await retryJob(page, jobId);
    expect(retriedJob.status).toBe('PENDING');
    expect(retriedJob.retry_count).toBe(1);
    
    // Verify new job appears in list
    await page.goto('/');
    await expect(page.locator(`text=${jobName}`)).toBeVisible();
  });

  test('should delete a job', async ({ page }) => {
    const jobName = uniqueName('delete-test');
    const jobId = await createJob(page, { ...defaultJob, name: jobName });
    
    // Wait for job to be created
    await waitForJobStatus(page, jobId, 'PENDING');
    
    // Delete the job
    const status = await deleteJob(page, jobId);
    expect(status).toBe(204);
    
    // Verify job is gone from list
    await page.goto('/');
    await expect(page.locator(`text=${jobName}`)).not.toBeVisible();
  });

  test('should filter jobs by status', async ({ page }) => {
    const jobName = uniqueName('filter-test');
    await createJob(page, { ...defaultJob, name: jobName });
    
    // Wait for job to appear
    await page.waitForTimeout(1000);
    
    // Filter by PENDING
    await page.selectOption('select[name="status"]', 'PENDING');
    await page.waitForTimeout(500);
    
    // Should see our job
    await expect(page.locator(`text=${jobName}`)).toBeVisible();
    
    // Filter by RUNNING
    await page.selectOption('select[name="status"]', 'RUNNING');
    await page.waitForTimeout(500);
    
    // Our job should not be visible (it's PENDING)
    await expect(page.locator(`text=${jobName}`)).not.toBeVisible();
  });

  test('should search jobs by name', async ({ page }) => {
    const jobName = uniqueName('search-test');
    await createJob(page, { ...defaultJob, name: jobName });
    
    await page.waitForTimeout(1000);
    
    // Search for the job
    await page.fill('input[placeholder*="search" i]', 'search-test');
    await page.waitForTimeout(500);
    
    // Should see our job
    await expect(page.locator(`text=${jobName}`)).toBeVisible();
    
    // Search for non-existent
    await page.fill('input[placeholder*="search" i]', 'non-existent-job-xyz');
    await page.waitForTimeout(500);
    
    // Should not see our job
    await expect(page.locator(`text=${jobName}`)).not.toBeVisible();
  });

  test('should paginate job list', async ({ page }) => {
    // Create multiple jobs
    for (let i = 0; i < 3; i++) {
      await createJob(page, { ...defaultJob, name: uniqueName(`page-test-${i}`) });
    }
    
    await page.waitForTimeout(1000);
    await page.goto('/');
    
    // Check pagination controls
    await expect(page.locator('text=Page')).toBeVisible();
  });
});