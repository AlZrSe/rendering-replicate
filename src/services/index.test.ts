/**
 * The VITE_CLUSTER_BACKEND matrix (issue #28).
 *
 * `src/services/index.ts` reads the variable once, at module scope, and that
 * read is the entire selection mechanism. Two consequences shape this file:
 *
 *  1. `vi.stubEnv()` after a static import changes nothing — the module has
 *     already captured the value. Every case therefore stubs the env, throws
 *     the module registry away, and dynamically re-imports, in that order.
 *     `loadServices()` is the only place that sequence is written down.
 *  2. `.env.test` (vitest's `test` mode) sets VITE_CLUSTER_BACKEND=mock, so the
 *     absent/other cases must *actively defeat* it or they would pass for the
 *     wrong reason. `control` below proves the file is really reading the env:
 *     if stubs had no effect, the "resolves to http" cases would come back
 *     "mock" and fail.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

/** Every value that must NOT select the mock. `undefined` is the fresh clone. */
const NON_MOCK_VALUES: ReadonlyArray<{ label: string; value: string | undefined }> = [
  { label: "absent", value: undefined },
  { label: "empty string", value: "" },
  { label: "whitespace only", value: "   " },
  { label: "http", value: "http" },
  { label: "HTTP", value: "HTTP" },
  { label: "Mock", value: "Mock" },
  { label: "mockk", value: "mockk" },
  { label: "auto", value: "auto" },
  { label: "1", value: "1" },
  { label: "true", value: "true" },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/**
 * Re-import `./index` with a freshly stubbed env. Order matters: the stub must
 * be in place before the module body runs.
 *
 * `ServiceError` is taken from the *reloaded* module rather than imported at
 * the top of the file — `vi.resetModules()` hands back a second copy of the
 * class, so `instanceof` only holds against the copy that actually threw.
 */
async function loadServices(value: string | undefined, stubEnv = true) {
  if (stubEnv) vi.stubEnv("VITE_CLUSTER_BACKEND", value);
  vi.resetModules();
  return await import("./index");
}

/** Rejecting fetch = backend down. */
function stubUnreachableFetch() {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
}

describe("service resolution (VITE_CLUSTER_BACKEND)", () => {
  it("control: .env.test is loaded, so an unstubbed run resolves to the mock", async () => {
    // Guards the whole file. If vi.stubEnv / vi.resetModules did not actually
    // change what ./index reads, the cases below would silently keep seeing
    // this value and would resolve to "mock" — i.e. fail loudly, which is the
    // point. This asserts the opposite direction so that a future change to
    // .env.test cannot quietly turn the matrix into a no-op either.
    expect(import.meta.env["VITE_CLUSTER_BACKEND"]).toBe("mock");

    const { getClusterAsync } = await loadServices(undefined, /* stubEnv */ false);
    expect((await getClusterAsync()).kind).toBe("mock");
  });

  it("T1: exactly 'mock' selects the mock and never touches the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { getClusterAsync } = await loadServices("mock");
    const service = await getClusterAsync();
    expect(service.kind).toBe("mock");

    // The probe is gone, so there is nothing that could have probed /health.
    await expect(service.listJobs({})).resolves.toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(NON_MOCK_VALUES)(
    "T2: VITE_CLUSTER_BACKEND=$label resolves to httpService even with the backend down",
    async ({ value }) => {
      stubUnreachableFetch();

      const { getClusterAsync, ServiceError } = await loadServices(value);
      const service = await getClusterAsync();
      expect(service.kind).toBe("http");

      // The mock would have answered with seed data; the real service must not.
      await expect(service.listJobs({})).rejects.toBeInstanceOf(ServiceError);
    },
  );

  it("T3: VITE_CLUSTER_BACKEND absent (fresh clone) talks to the real backend and surfaces a ServiceError", async () => {
    // The regression test for #28: the env files were untracked, so a fresh
    // clone had no VITE_CLUSTER_BACKEND at all, the old auto-detection probe
    // ran, the backend was down, and mockService was selected by default.
    stubUnreachableFetch();
    vi.stubEnv("VITE_CLUSTER_BACKEND", undefined);
    // Genuinely absent, not "" — this is what a clone without an env file sees.
    expect(import.meta.env["VITE_CLUSTER_BACKEND"]).toBeUndefined();

    vi.resetModules();
    const { getClusterAsync, listJobs, ServiceError } = await import("./index");
    expect((await getClusterAsync()).kind).toBe("http");

    const error = await listJobs().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as InstanceType<typeof ServiceError>).error_code).toBe("BACKEND_UNREACHABLE");
  });
});
