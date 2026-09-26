import { test, expect } from '@playwright/test';
import { login, TEST_TOKEN, getNodes, getNodeMetrics, uniqueName } from './test-utils';

test.describe('Node Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await login(page, TEST_TOKEN);
  });

  test('should list all nodes', async ({ page }) => {
    await page.goto('/nodes');
    await expect(page).toHaveURL('/nodes');
    
    // Should show at least 4 seed nodes
    await expect(page.locator('text=node-alpha')).toBeVisible();
    await expect(page.locator('text=node-beta')).toBeVisible();
    await expect(page.locator('text=node-gamma')).toBeVisible();
    await expect(page.locator('text=node-delta')).toBeVisible();
  });

  test('should show node details', async ({ page }) => {
    await page.goto('/nodes');
    
    // Click on node-alpha
    await page.click('a[href="/nodes/node-alpha"]');
    await expect(page).toHaveURL('/nodes/node-alpha');
    
    // Verify node details
    await expect(page.locator('text=node-alpha')).toBeVisible();
    await expect(page.locator('text=alpha.lan')).toBeVisible();
    await expect(page.locator('text=Ubuntu 24.04')).toBeVisible();
    await expect(page.locator('text=ONLINE')).toBeVisible();
    await expect(page.locator('text=NVIDIA RTX 4090')).toBeVisible();
  });

  test('should show node metrics', async ({ page }) => {
    await page.goto('/nodes/node-alpha');
    
    // Click metrics tab
    await page.click('text=Metrics');
    
    // Wait for metrics to load
    await expect(page.locator('text=GPU Memory')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=GPU Utilization')).toBeVisible();
    await expect(page.locator('text=CPU Usage')).toBeVisible();
    
    // Verify charts are rendered
    await expect(page.locator('canvas, svg')).toBeVisible();
  });

  test('should show CPU-only node metrics', async ({ page }) => {
    await page.goto('/nodes/node-delta');
    
    // Click metrics tab
    await page.click('text=Metrics');
    
    // Wait for metrics to load
    await expect(page.locator('text=GPU Memory')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=CPU Usage')).toBeVisible();
  });

  test('should show node status correctly', async ({ page }) => {
    await page.goto('/nodes');
    
    // node-alpha, beta, gamma should be ONLINE
    await expect(page.locator('text=node-alpha').locator('..').locator('text=ONLINE')).toBeVisible();
    await expect(page.locator('text=node-beta').locator('..').locator('text=ONLINE')).toBeVisible();
    await expect(page.locator('text=node-gamma').locator('..').locator('text=ONLINE')).toBeVisible();
    
    // node-delta should be OFFLINE
    await expect(page.locator('text=node-delta').locator('..').locator('text=OFFLINE')).toBeVisible();
  });

  test('should show current job assignment', async ({ page }) => {
    await page.goto('/nodes');
    
    // Check that nodes with jobs show current_job_id
    const nodeAlpha = page.locator('text=node-alpha').locator('..');
    await expect(nodeAlpha.locator('text=job-')).toBeVisible();
  });

  test('should fetch nodes via API', async ({ page }) => {
    const nodes = await getNodes(page);
    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes.length).toBeGreaterThanOrEqual(4);
    
    const nodeIds = nodes.map((n: any) => n.node_id);
    expect(nodeIds).toContain('node-alpha');
    expect(nodeIds).toContain('node-beta');
    expect(nodeIds).toContain('node-gamma');
    expect(nodeIds).toContain('node-delta');
  });

  test('should fetch node metrics via API', async ({ page }) => {
    const metrics = await getNodeMetrics(page, 'node-alpha');
    expect(metrics.job_id).toBe('node:node-alpha');
    expect(metrics.gpu_metrics.length).toBeGreaterThan(0);
    expect(metrics.cpu_metrics.length).toBeGreaterThan(0);
    expect(metrics.summary.gpu_memory_avg_mb).toBeGreaterThan(0);
    expect(metrics.summary.cpu_avg_percent).toBeGreaterThan(0);
  });

  test('should handle non-existent node', async ({ page }) => {
    const response = await page.request.get('http://localhost:8000/api/v1/nodes/non-existent/metrics', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect(response.status()).toBe(404);
  });
});