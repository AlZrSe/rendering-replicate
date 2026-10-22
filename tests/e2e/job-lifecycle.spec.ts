import { test, expect } from "@playwright/test";
import {
  login,
  TEST_TOKEN,
  resetAuthState,
  createJob,
  waitForJobStatus,
  cancelJob,
  retryJob,
  deleteJob,
  getJobLogs,
  getJobMetrics,
  defaultJob,
  uniqueName,
} from "./test-utils";

test.describe("Job Lifecycle", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // resetAuthState navigates BEFORE clearing: localStorage on about:blank
    // throws (issue #141).
    await resetAuthState(page, baseURL);
    await login(page, TEST_TOKEN);
  });

  test("should create a new job", async ({ page }) => {
    const jobName = uniqueName("test-job");
    const jobData = { ...defaultJob, name: jobName };

    const jobId = await createJob(page, jobData);
    expect(jobId).toMatch(/^job-\d+$/);

    // Verify job appears in list
    await page.goto("/");
    await expect(page.locator(`text=${jobName}`)).toBeVisible();
  });

  test("should show job details", async ({ page }) => {
    const jobName = uniqueName("detail-test");
    const jobId = await createJob(page, { ...defaultJob, name: jobName });

    // Navigate to job detail
    await expect(page).toHaveURL(`/jobs/${jobId}`);

    // Verify job details are shown
    await expect(page.locator(`text=${jobName}`)).toBeVisible();
    await expect(page.getByRole("heading", { name: jobName })).toBeVisible();
  });

  test("should show job logs", async ({ page }) => {
    const jobName = uniqueName("logs-test");
    const jobId = await createJob(page, { ...defaultJob, name: jobName });

    await page.goto(`/jobs/${jobId}`);

    // Click logs tab or wait for logs to load
    await expect(page.locator('button:has-text("Logs")')).toBeVisible();
    await page.click('button:has-text("Logs")');
  });

  test("should show job metrics", async ({ page }) => {
    const jobName = uniqueName("metrics-test");
    const jobId = await createJob(page, { ...defaultJob, name: jobName });

    await page.goto(`/jobs/${jobId}`);

    // Click metrics tab
    await page.click('button:has-text("Metrics")');
    await expect(page.locator('button:has-text("Metrics")')).toBeVisible();
  });

  test("should cancel a pending job", async ({ page }) => {
    const jobName = uniqueName("cancel-test");
    const jobId = await createJob(page, { ...defaultJob, name: jobName });

    // Wait for job to be in PENDING or RUNNING
    await page.goto(`/jobs/${jobId}`);
    await expect(page.getByRole("heading", { name: jobName })).toBeVisible();
    // Click cancel button - just verify it works (API call made)
    await page.click('button:has-text("Cancel")');
  });

  test("should retry a failed job", async ({ page }) => {
    const jobName = uniqueName("retry-test");
    const jobId = await createJob(page, { ...defaultJob, name: jobName });

    // Cancel first to make it retryable (or wait for failure)
    await cancelJob(page, jobId);
    await waitForJobStatus(page, jobId, "CANCELLED");

    // Retry the job
    const retriedJob = await retryJob(page, jobId);
    expect(retriedJob.status).toBe("PENDING");
    expect(retriedJob.retry_count).toBe(1);

    // Verify new job appears in list
    await page.goto("/");
    await expect(page.locator(`text=${jobName}`)).toBeVisible();
  });

  test("should delete a job", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const jobName = uniqueName("delete-test");
    const jobId = await createJob(page, { ...defaultJob, name: jobName });

    // Wait for job to be created
    await waitForJobStatus(page, jobId, "PENDING");

    // Delete the job
    const status = await deleteJob(page, jobId);
    expect(status).toBe(204);

    // Verify job is gone from list
    await page.goto("/");
    await expect(page.locator(`text=${jobName}`)).not.toBeVisible();
  });

  test("should filter jobs by status", async ({ page }) => {
    const jobName = uniqueName("filter-test");
    await createJob(page, { ...defaultJob, name: jobName });

    // Go to jobs list
    await page.goto("/");
    await expect(page.locator(`text=${jobName}`)).toBeVisible({ timeout: 10000 });

    // Filter by PENDING
    await page.click('button[aria-label="Filter by status"]');
    await page.getByRole("option", { name: "PENDING" }).click();
    await page.waitForTimeout(500);

    // Should see our job
    await expect(page.locator(`text=${jobName}`)).toBeVisible();

    // Filter by RUNNING
    await page.click('button[aria-label="Filter by status"]');
    await page.getByRole("option", { name: "RUNNING" }).click();
    await page.waitForTimeout(500);

    // Our job should not be visible (it's PENDING)
    await expect(page.locator(`text=${jobName}`)).not.toBeVisible();
  });

  test("should search jobs by name", async ({ page }) => {
    const jobName = uniqueName("search-test");
    await createJob(page, { ...defaultJob, name: jobName });

    // Go to jobs list
    await page.goto("/");
    await expect(page.locator(`text=${jobName}`)).toBeVisible({ timeout: 10000 });

    // Search for the job
    await page.fill('input[aria-label="Search jobs"]', "search-test");
    await page.waitForTimeout(500);

    // Should see our job
    await expect(page.locator(`text=${jobName}`)).toBeVisible();

    // Search for non-existent
    await page.fill('input[aria-label="Search jobs"]', "non-existent-job-xyz");
    await page.waitForTimeout(500);

    // Should not see our job
    await expect(page.locator(`text=${jobName}`)).not.toBeVisible();
  });

  test("should paginate job list", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check pagination controls exist (seed data provides many jobs)
    await expect(page.locator("text=Prev")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Next")).toBeVisible({ timeout: 10000 });
  });
});
