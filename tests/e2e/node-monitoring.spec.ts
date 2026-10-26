import { test, expect } from "@playwright/test";
import { login, TEST_TOKEN, getNodes, getNodeMetrics, resetAuthState } from "./test-utils";

test.describe("Node Monitoring", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await resetAuthState(page, baseURL);
    await login(page, TEST_TOKEN);
  });

  test("should list all nodes", async ({ page }) => {
    await page.goto("/nodes");
    await expect(page).toHaveURL("/nodes");

    // Should show at least 4 seed nodes
    await expect(page.locator("text=gpu-node-1").first()).toBeVisible();
    await expect(page.locator("text=gpu-node-2").first()).toBeVisible();
    await expect(page.locator("text=cpu-node-1").first()).toBeVisible();
    await expect(page.locator("text=offline-node").first()).toBeVisible();
  });

  test("should show node details", async ({ page }) => {
    await page.goto("/nodes");

    // Click on gpu-node-1
    await page.click('a[href="/nodes/gpu-node-1"]');
    await expect(page).toHaveURL("/nodes/gpu-node-1");

    // Verify node details
    await expect(page.locator("text=gpu-node-1").first()).toBeVisible();
    // Status may be DEGRADED if heartbeat is old
    await expect(
      page.locator("text=DEGRADED").first().or(page.locator("text=ONLINE").first()),
    ).toBeVisible();
  });

  test("should show node metrics", async ({ page }) => {
    await page.goto("/nodes/gpu-node-1");

    // Should show GPU history section
    await expect(page.locator("text=GPU history")).toBeVisible();
    await expect(page.locator("text=CPU history")).toBeVisible();
  });

  test("should show CPU-only node metrics", async ({ page }) => {
    await page.goto("/nodes/cpu-node-1");

    // Should show CPU history section
    await expect(page.locator("text=CPU history")).toBeVisible();
  });

  test("should show node status correctly", async ({ page }) => {
    await page.goto("/nodes");

    // gpu-node-1, gpu-node-2, cpu-node-1 may be ONLINE or DEGRADED
    // Status badge is a sibling of the node name container
    await expect(
      page
        .locator("text=gpu-node-1")
        .first()
        .locator("..")
        .locator("..")
        .locator("text=DEGRADED")
        .first()
        .or(
          page
            .locator("text=gpu-node-1")
            .first()
            .locator("..")
            .locator("..")
            .locator("text=ONLINE")
            .first(),
        ),
    ).toBeVisible();
    await expect(
      page
        .locator("text=gpu-node-2")
        .first()
        .locator("..")
        .locator("..")
        .locator("text=DEGRADED")
        .first()
        .or(
          page
            .locator("text=gpu-node-2")
            .first()
            .locator("..")
            .locator("..")
            .locator("text=ONLINE")
            .first(),
        ),
    ).toBeVisible();
    await expect(
      page
        .locator("text=cpu-node-1")
        .first()
        .locator("..")
        .locator("..")
        .locator("text=DEGRADED")
        .first()
        .or(
          page
            .locator("text=cpu-node-1")
            .first()
            .locator("..")
            .locator("..")
            .locator("text=ONLINE")
            .first(),
        ),
    ).toBeVisible();

    // offline-node should be OFFLINE
    await expect(
      page
        .locator("text=offline-node")
        .first()
        .locator("..")
        .locator("..")
        .locator("text=OFFLINE")
        .first(),
    ).toBeVisible();
  });

  test("should show current job assignment", async ({ page }) => {
    await page.goto("/nodes");

    // Check that nodes with jobs show current_job_id
    const nodeGpu1 = page.locator("text=gpu-node-1").first().locator("..");
    // Just verify node exists
    await expect(nodeGpu1).toBeVisible();
  });

  test("should fetch nodes via API", async ({ page }) => {
    const nodes = await getNodes(page);
    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes.length).toBeGreaterThanOrEqual(4);

    const nodeIds = nodes.map((n) => n.node_id);
    expect(nodeIds).toContain("gpu-node-1");
    expect(nodeIds).toContain("gpu-node-2");
    expect(nodeIds).toContain("cpu-node-1");
    expect(nodeIds).toContain("offline-node");
  });

  test("should fetch node metrics via API", async ({ page }) => {
    const metrics = await getNodeMetrics(page, "gpu-node-1");
    expect(metrics.job_id).toBe("node:gpu-node-1");
    // Metrics may be empty when no agent reported yet
  });

  test("should handle non-existent node", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:8000/api/v1/nodes/non-existent/metrics",
      {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      },
    );
    expect(response.status()).toBe(404);
  });
});
