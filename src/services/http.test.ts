/**
 * Network-failure and HTTP-error normalisation in `httpService` (issue #28).
 *
 * These cases drive `httpService` directly with a stubbed `fetch`. That is safe
 * here and only here: `http.ts` reads no env var at module scope, so a static
 * import of the implementation is already the whole story. (See
 * ./index.test.ts for why the resolver's own tests cannot work that way.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpService } from "./testing";
import { ServiceError } from "./types";
import { setSettings } from "@/lib/settings";

/** Minimal stand-in — the tests only ever touch `ok`, `status` and `json()`. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  setSettings({ apiBaseUrl: "http://backend.invalid/api/v1", token: "test-token" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("httpService network failures", () => {
  it("T4: a fetch rejection becomes ServiceError(0, BACKEND_UNREACHABLE), never a raw TypeError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await httpService.listJobs({}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceError);
    const serviceError = error as ServiceError;
    // status 0 == "no HTTP response was produced". See ServiceError.status.
    expect(serviceError.status).toBe(0);
    expect(serviceError.error_code).toBe("BACKEND_UNREACHABLE");
    // The underlying cause is kept for debugging, not shown to the user.
    expect(serviceError.detail).toBe("Failed to fetch");
  });

  it("T4b: every request() method normalises, not just listJobs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const calls: Array<() => Promise<unknown>> = [
      () => httpService.listNodes(),
      () => httpService.getNode("node-01"),
      () => httpService.getJobMetrics("job-1"),
      () => httpService.getNodeMetrics("node-01"),
      () => httpService.getJob("job-1"),
      () =>
        // The nested shape is `JobSpec` as `src/lib/types.ts` declares it (and as
        // `openapi.yaml` documents it): resources/paths/retry, not the flat
        // `{ gpus, cpus, ... }` of `Profile`. The spec is never inspected here —
        // `fetch` is stubbed to reject — only serialised, so this case is about
        // `createJob` normalising, not about which fields the job asks for.
        httpService.createJob({
          name: "x",
          command: "echo",
          working_dir: "/tmp",
          env: {},
          resources: { gpus: 0, cpus: 1, memory_gb: 1, vram_gb: 0 },
          paths: { input: "in", output: "out" },
        }),
      () => httpService.retryJob("job-1"),
      () => httpService.cancelJob("job-1"),
      () => httpService.deleteJob("job-1"),
    ];

    for (const call of calls) {
      const error = await call().catch((e: unknown) => e);
      expect(error, `expected ServiceError, got ${String(error)}`).toBeInstanceOf(ServiceError);
      expect((error as ServiceError).status).toBe(0);
      expect((error as ServiceError).error_code).toBe("BACKEND_UNREACHABLE");
    }
  });
});

describe("httpService HTTP errors", () => {
  it.each([
    { status: 500, error_code: "INTERNAL_ERROR", title: "Internal Server Error" },
    { status: 404, error_code: "JOB_NOT_FOUND", title: "Not Found" },
    { status: 401, error_code: "AUTH_SHARED_TOKEN_INVALID", title: "Unauthorized" },
  ])(
    "T5: HTTP $status keeps its status and takes error_code from the body",
    async ({ status, error_code, title }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(status, {
            status,
            title,
            detail: `backend said ${status}`,
            instance: "/jobs",
            error_code,
          }),
        ),
      );

      const error = await httpService.listJobs({}).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServiceError);
      const serviceError = error as ServiceError;
      expect(serviceError.status).toBe(status);
      expect(serviceError.status).not.toBe(0);
      expect(serviceError.error_code).toBe(error_code);
      expect(serviceError.title).toBe(title);
      expect(serviceError.detail).toBe(`backend said ${status}`);
    },
  );

  it("T5b: a non-JSON error body still produces a ServiceError with the real status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      } as unknown as Response),
    );

    const error = await httpService.listJobs({}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).status).toBe(502);
    expect((error as ServiceError).error_code).toBeUndefined();
  });
});

describe("httpService.validateToken", () => {
  it("T7: an unreachable backend throws instead of returning a verdict", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await httpService.validateToken("x".repeat(12)).then(
      () => ({ returned: true as const, value: undefined, error: undefined }),
      (e: unknown) => ({ returned: false as const, value: undefined, error: e }),
    );

    // Not `false`: "I could not ask" is not "your token is bad".
    expect(result.returned).toBe(false);
    expect(result.error).toBeInstanceOf(ServiceError);
    expect((result.error as ServiceError).status).toBe(0);
    expect((result.error as ServiceError).error_code).toBe("BACKEND_UNREACHABLE");
  });

  it.each([
    { status: 401, expected: false },
    { status: 403, expected: false },
    { status: 200, expected: true },
  ])("T8: HTTP $status from /auth/verify yields $expected", async ({ status, expected }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, {})));

    await expect(httpService.validateToken("x".repeat(12))).resolves.toBe(expected);
  });
});
