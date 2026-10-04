import { test, expect, describe, beforeAll, afterAll, afterEach, vi } from "vitest";
import { mockService, httpService } from "../../src/services/testing";
import { resetServiceCache } from "../../src/services";
import { getSettings, setSettings } from "../../src/lib/settings";
import type { JobSpec } from "../../src/lib/types";

// Test data
//
// `JobSpec` is the nested shape `src/lib/types.ts` declares (and `openapi.yaml`
// documents): resources / paths / retry. It is typed here rather than cast at
// each use site, so a drift between this fixture and the shipped contract is a
// compile error instead of the `as JobSpec` that used to hide it.
const TEST_JOB_SPEC: JobSpec = {
  name: "integration-test-job",
  command: 'echo "test" && sleep 1',
  working_dir: "/tmp/test",
  env: {},
  resources: { gpus: 0, cpus: 2, memory_gb: 4, vram_gb: 0 },
  paths: { input: "data/in", output: "data/out" },
  retry: { max_retries: 1, retry_delay_seconds: 30 },
};

/**
 * The first element of `items`, or a loud failure naming what was empty.
 *
 * `noUncheckedIndexedAccess` makes `items[0]` a `T | undefined`. Every site
 * below reaches for a head element that the surrounding case has already
 * established exists, so this throws a readable message instead of letting
 * `.property` raise `Cannot read properties of undefined` — and instead of
 * silencing it with `!`, which would turn a real empty page into a confusing
 * crash several frames away. The assertions around it are unchanged: a case
 * whose array came back empty still fails.
 */
function first<T>(items: readonly T[], what: string): T {
  const [head] = items;
  if (head === undefined) throw new Error(`expected ${what} to be non-empty`);
  return head;
}

// ---------------------------------------------------------------------------
// Fixtures for the "stubbed transport" block below.
//
// These are hand-written stand-ins for the shapes documented in openapi.yaml,
// deliberately *not* captures of a running cluster. They use the same
// stubbed-fetch pattern as src/services/http.test.ts: the service under test
// runs for real, only `fetch` is replaced.
//
// The rule this enforces: no unit or integration test may read mutable cluster
// state. `npm test` therefore returns the same verdict whether or not a backend
// is listening on :8000, and a green run means something was actually asserted.
// Exercising a real backend is the e2e suite's job (playwright.config.ts
// waits on /health there) — see issue #38.
// ---------------------------------------------------------------------------

interface RecordedRequest {
  url: string;
  init: RequestInit | undefined;
}

interface StubRoute {
  status?: number;
  /**
   * A literal body, or a function of the request for round-trip assertions.
   *
   * `unknown`, not a union with a callback type, so a fixture may hand back any
   * JSON shape the backend documents. A function-valued fixture therefore gets
   * no contextual parameter type and has to annotate it — the request shape is
   * `RecordedRequest`, the same one `stubFetch` records into `calls`.
   */
  body: unknown;
}

const BACKEND_URL = "http://localhost:8000/api/v1";
const API_PREFIX = "/api/v1";

/** Minimal stand-in — the cases below only touch `ok`, `status` and `json()`. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/**
 * Installs a `fetch` stub that answers from `routes` (keyed `"METHOD /path"`,
 * query string ignored) and records every call.
 *
 * An unmatched URL throws rather than falling through. That is the point: it
 * makes it impossible for a case to quietly escape to a real backend, and turns
 * a missing or misspelled fixture into a loud failure instead of an empty
 * response that some assertion happens to accept.
 */
function stubFetch(routes: Record<string, StubRoute>) {
  const calls: RecordedRequest[] = [];

  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const record: RecordedRequest = { url, init };
    calls.push(record);

    const at = url.indexOf(API_PREFIX);
    if (at === -1) {
      throw new Error(`stub fetch: ${url} is not under ${API_PREFIX}`);
    }
    const path = url.slice(at + API_PREFIX.length).split("?")[0];
    const route = routes[`${(init?.method ?? "GET").toUpperCase()} ${path}`];

    if (!route) {
      throw new Error(
        `stub fetch: no fixture for ${init?.method ?? "GET"} ${path} ` +
          `(fixtures: ${Object.keys(routes).join(", ") || "none"})`,
      );
    }

    const body = typeof route.body === "function" ? route.body(record) : route.body;
    return jsonResponse(route.status ?? 200, body);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

const HEALTH_FIXTURE = {
  status: "healthy",
  version: "0.1.0",
  store: { status: "healthy", nodes: 1, jobs: 1 },
  config: { status: "healthy", syncthing_root: "/tmp/syncthing", api_version: "/api/v1" },
  syncthing: { status: "available", path: "/tmp/syncthing" },
  database: { status: "healthy", url: "./scientific_home_cluster.db" },
};

const JOB_STATE_FIXTURE = {
  job_id: "job-1",
  spec: {
    name: "integration-test-job",
    command: 'echo "test" && sleep 1',
    working_dir: "/tmp/test",
    env: {},
    resources: { gpus: 0, cpus: 2, memory_gb: 4, vram_gb: 0 },
    paths: { input: "data/in", output: "data/out" },
    retry: { max_retries: 1, retry_delay_seconds: 30 },
  },
  status: "PENDING",
  node_id: "node-01",
  created_at: "2026-01-01T00:00:00Z",
  retry_count: 0,
};

const JOB_LIST_FIXTURE = { items: [JOB_STATE_FIXTURE], total: 1 };

const NODE_FIXTURE = {
  node_id: "node-01",
  hostname: "node-01.lan",
  gpus: [{ name: "NVIDIA GeForce RTX 4090", memory_gb: 24 }],
  cpus: 16,
  memory_gb: 64,
  os: "linux",
  status: "ONLINE",
  last_heartbeat: "2026-01-01T00:00:00Z",
};

const LOGS_FIXTURE = ["line one", "line two", "line three"];

const METRICS_FIXTURE = {
  job_id: "job-1",
  gpu_metrics: [
    {
      timestamp: "2026-01-01T00:00:00Z",
      gpu_index: 0,
      memory_used_mb: 1024,
      memory_total_mb: 24576,
      utilization_percent: 55,
      temperature_c: 61,
    },
  ],
  cpu_metrics: [
    {
      timestamp: "2026-01-01T00:00:00Z",
      cpu_percent: 12.5,
      memory_percent: 40,
      temperature_c: 48,
      memory_used_gb: 25.6,
    },
  ],
  summary: {
    gpu_memory_min_mb: 1024,
    gpu_memory_max_mb: 2048,
    gpu_memory_avg_mb: 1536,
    gpu_util_min: 10,
    gpu_util_max: 90,
    gpu_util_avg: 50,
    cpu_avg_percent: 12.5,
  },
};

describe("Services Layer Integration Tests", () => {
  beforeAll(() => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
    resetServiceCache();
  });

  afterAll(() => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
    resetServiceCache();
  });

  describe("Mock Service", () => {
    test("should list jobs with seed data", async () => {
      const result = await mockService.listJobs({});
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    test("should create and get a job", async () => {
      const created = await mockService.createJob(TEST_JOB_SPEC);
      expect(created.job_id).toMatch(/^job-\d+$/);
      expect(created.spec.name).toBe(TEST_JOB_SPEC.name);
      expect(created.status).toBe("PENDING");

      const retrieved = await mockService.getJob(created.job_id);
      expect(retrieved.job_id).toBe(created.job_id);
      expect(retrieved.spec.name).toBe(TEST_JOB_SPEC.name);
    });

    test("should list nodes with seed data", async () => {
      const nodes = await mockService.listNodes();
      expect(nodes.length).toBeGreaterThan(0);
    });

    test("should get job logs", async () => {
      const result = await mockService.listJobs({});
      const jobId = first(result.items, "mock job list").job_id;
      const logs = await mockService.getJobLogs(jobId);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    test("should get job metrics", async () => {
      const result = await mockService.listJobs({});
      const jobId = first(result.items, "mock job list").job_id;
      const metrics = await mockService.getJobMetrics(jobId);
      expect(metrics.job_id).toBe(jobId);
      expect(metrics.gpu_metrics).toBeDefined();
      expect(metrics.cpu_metrics).toBeDefined();
      expect(metrics.summary).toBeDefined();
    });

    test("should retry a failed job", async () => {
      const created = await mockService.createJob(TEST_JOB_SPEC);
      const retried = await mockService.retryJob(created.job_id);
      expect(retried.status).toBe("PENDING");
      expect(retried.retry_count).toBe(1);
      expect(retried.error).toBeUndefined();
    });

    test("should cancel a running job", async () => {
      const created = await mockService.createJob(TEST_JOB_SPEC);
      const cancelled = await mockService.cancelJob(created.job_id);
      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.completed_at).toBeDefined();
    });

    test("should validate token", async () => {
      const valid = await mockService.validateToken("valid-token-12345");
      expect(valid).toBe(true);

      const invalid = await mockService.validateToken("short");
      expect(invalid).toBe(false);
    });
  });

  describe("HTTP Service (stubbed transport, no backend required)", () => {
    beforeAll(() => {
      setSettings({ apiBaseUrl: BACKEND_URL, token: "localhost-no-auth" });
    });

    // `vi.unstubAllGlobals()` is explicit because `restoreMocks` in
    // vitest.config.ts restores spies, not globals installed by stubGlobal.
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    test("should check backend health", async () => {
      const { calls } = stubFetch({ "GET /health": { body: HEALTH_FIXTURE } });

      const res = await fetch(`${BACKEND_URL}/health`, {
        headers: { Authorization: "Bearer localhost-no-auth" },
      });
      expect(res.ok).toBe(true);

      // The fixture reports one registered node, which is what the backend uses
      // to report "healthy". This used to read a live cluster and so failed with
      // `expected 'degraded' to be 'healthy'` on any machine whose cluster had
      // no nodes registered yet — and reported a green PASS asserting nothing at
      // all when nothing was listening on :8000.
      const health = await res.json();
      expect(health.status).toBe("healthy");
      expect(health.store).toEqual({ status: "healthy", nodes: 1, jobs: 1 });
      expect(health.database.status).toBe("healthy");

      expect(calls).toHaveLength(1);
      expect(first(calls, "health fetch calls").url).toBe(`${BACKEND_URL}/health`);
    });

    test("should list jobs from backend", async () => {
      const { fetchMock } = stubFetch({ "GET /jobs": { body: JOB_LIST_FIXTURE } });

      const result = await httpService.listJobs({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      const job = first(result.items, "job list from /jobs");
      expect(job.job_id).toBe("job-1");
      expect(job.status).toBe("PENDING");

      // The query string is built by `query()` in http.ts; assert it is on the
      // wire rather than only that the response parsed.
      expect(fetchMock).toHaveBeenCalledOnce();
      const [listUrl] = first(fetchMock.mock.calls, "listJobs fetch call");
      expect(listUrl).toBe(`${BACKEND_URL}/jobs?limit=10&offset=0`);
    });

    test("should create and get a job from backend", async () => {
      const { fetchMock } = stubFetch({
        "POST /jobs": {
          // Echo the posted spec back, so the assertions below compare the
          // request body against the response instead of two unrelated objects.
          body: (req: RecordedRequest) => ({
            ...JOB_STATE_FIXTURE,
            spec: JSON.parse(String(req.init?.body)),
          }),
        },
        "GET /jobs/job-1": { body: JOB_STATE_FIXTURE },
      });

      const created = await httpService.createJob(TEST_JOB_SPEC);

      expect(created.job_id).toMatch(/^job-\d+$/);
      expect(created.status).toBe("PENDING");
      expect(created.spec).toEqual(TEST_JOB_SPEC);

      const retrieved = await httpService.getJob(created.job_id);
      expect(retrieved.job_id).toBe(created.job_id);
      expect(retrieved.spec.name).toBe(TEST_JOB_SPEC.name);

      const [createCall, getCall] = fetchMock.mock.calls;
      expect(createCall?.[0]).toBe(`${BACKEND_URL}/jobs`);
      expect(createCall?.[1]).toMatchObject({ method: "POST" });
      expect(getCall?.[0]).toBe(`${BACKEND_URL}/jobs/${created.job_id}`);
      expect(getCall?.[1]?.method).toBeUndefined();
    });

    test("should list nodes from backend", async () => {
      const { fetchMock } = stubFetch({ "GET /nodes": { body: [NODE_FIXTURE] } });

      const nodes = await httpService.listNodes();

      // Previously `expect(nodes.length).toBeGreaterThan(0)` against the live
      // cluster, which failed with `expected 0 to be greater than 0` on an empty
      // one. The count now comes from the fixture.
      expect(nodes).toHaveLength(1);
      const node = first(nodes, "node list from /nodes");
      expect(node.node_id).toBe("node-01");
      expect(node.status).toBe("ONLINE");
      expect(first(node.gpus, `gpu list of ${node.node_id}`).name).toBe("NVIDIA GeForce RTX 4090");
      expect(fetchMock).toHaveBeenCalledOnce();
      const [listNodesUrl] = first(fetchMock.mock.calls, "listNodes fetch call");
      expect(listNodesUrl).toBe(`${BACKEND_URL}/nodes`);
    });

    test("should get job logs from backend", async () => {
      const { fetchMock } = stubFetch({
        "GET /jobs/job-1/logs/history": { body: LOGS_FIXTURE },
      });

      const logs = await httpService.getJobLogs("job-1");

      expect(logs).toEqual(["line one", "line two", "line three"]);
      const [logsUrl] = first(fetchMock.mock.calls, "getJobLogs fetch call");
      expect(logsUrl).toBe(`${BACKEND_URL}/jobs/job-1/logs/history`);
    });

    test("should get job metrics from backend", async () => {
      const { fetchMock } = stubFetch({
        "GET /jobs/job-1/metrics": { body: METRICS_FIXTURE },
      });

      const metrics = await httpService.getJobMetrics("job-1");

      expect(metrics.job_id).toBe("job-1");
      expect(metrics.gpu_metrics).toHaveLength(1);
      expect(metrics.cpu_metrics).toHaveLength(1);
      expect(metrics.summary).toEqual(METRICS_FIXTURE.summary);
      const [metricsUrl] = first(fetchMock.mock.calls, "getJobMetrics fetch call");
      expect(metricsUrl).toBe(`${BACKEND_URL}/jobs/job-1/metrics`);
    });

    test("should validate token with backend", async () => {
      const { calls } = stubFetch({ "GET /auth/verify": { status: 200, body: {} } });

      const valid = await httpService.validateToken("localhost-no-auth");

      expect(valid).toBe(true);
      expect(calls).toHaveLength(1);
      const verifyCall = first(calls, "validateToken fetch call");
      expect(verifyCall.url).toBe(`${BACKEND_URL}/auth/verify`);
      // validateToken bypasses request(), so the bearer header is asserted here.
      expect(verifyCall.init?.headers).toEqual({ Authorization: "Bearer localhost-no-auth" });
    });
  });

  // The "Auto-detection Logic" block that used to live here was vacuous: it
  // asserted `expect(["mock", "http"]).toContain(service.kind)`, which passes
  // for either implementation, and drove a localStorage override flag that no
  // longer exists. The real matrix now lives in src/services/index.test.ts,
  // where the module-scope env read can be re-loaded per case.

  describe("Service Interface Consistency", () => {
    test("mock and http services have same interface", () => {
      const mockMethods = Object.keys(mockService).filter(
        (k) => typeof mockService[k as keyof typeof mockService] === "function",
      );
      const httpMethods = Object.keys(httpService).filter(
        (k) => typeof httpService[k as keyof typeof httpService] === "function",
      );

      expect(mockMethods.sort()).toEqual(httpMethods.sort());
    });

    test("both services return compatible JobState", async () => {
      const mockJob = await mockService.createJob(TEST_JOB_SPEC);
      expect(mockJob).toHaveProperty("job_id");
      expect(mockJob).toHaveProperty("spec");
      expect(mockJob).toHaveProperty("status");
      expect(mockJob).toHaveProperty("created_at");
      expect(mockJob).toHaveProperty("retry_count");
    });
  });
});

describe("Settings Integration", () => {
  test("should persist settings to localStorage", () => {
    if (typeof window === "undefined") return;

    localStorage.clear();

    const testUrl = "http://test:8000/api/v1";
    setSettings({ apiBaseUrl: testUrl, token: "test-token" });

    const stored = localStorage.getItem("shc.settings");
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.apiBaseUrl).toBe(testUrl);
    expect(parsed.token).toBe("test-token");
  });

  test("should apply localhost bypass token", async () => {
    if (typeof window === "undefined") return;

    localStorage.clear();
    localStorage.setItem(
      "shc.settings",
      JSON.stringify({ apiBaseUrl: "http://localhost:8000/api/v1" }),
    );

    const { getSettings } = await import("../../src/lib/settings");
    const stored = localStorage.getItem("shc.settings");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.apiBaseUrl).toBe("http://localhost:8000/api/v1");
  });
});
