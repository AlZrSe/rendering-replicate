/**
 * Services layer: the app's only door to the backend.
 *
 * Components never call fetch/WebSocket directly — they import the named
 * wrappers below from `@/services`, which is the single entry point to both
 * ClusterService implementations. Which implementation runs is decided once,
 * synchronously, at module scope, from `VITE_CLUSTER_BACKEND`:
 *
 *   VITE_CLUSTER_BACKEND=mock  ->  mockService
 *   anything else, or unset    ->  httpService (the real FastAPI backend)
 *
 * The match on `mock` is exact and case-sensitive. There is no health probe
 * and no fallback: a value that is not literally `mock` — including `Mock`,
 * `mockk`, `auto`, `1` and `true`, and above all *absent*, which is what a
 * fresh clone looks like because the env files were not tracked until #28 —
 * always resolves to the real backend. So the failure mode of a typo is
 * "talks to the real backend and reports a connection error", never "silently
 * fabricates jobs and metrics".
 */
import { mockService } from "./mock";
import { httpService } from "./http";
import type {
  ClusterService,
  JobQuery,
  JobListResult,
  JobState,
  JobSpec,
  JobMetrics,
  NodeSpec,
  LogStreamStatus,
  Unsubscribe,
} from "./types";

const configured = (import.meta.env["VITE_CLUSTER_BACKEND"] ?? "").trim();

/** Only the exact string `mock` selects the mock. See the module comment. */
const useMock = configured === "mock";

if (import.meta.env.DEV && configured !== "" && !useMock) {
  console.warn(
    `[services] VITE_CLUSTER_BACKEND=${JSON.stringify(configured)} is not "mock" — using the real backend.`,
  );
}

let currentService: ClusterService | null = null;

/**
 * Test-only: forget the resolved service so the next call resolves again.
 * There is no health-probe result cached any more, so this resets the service
 * choice and nothing else.
 */
export function resetServiceCache() {
  currentService = null;
}

/**
 * Kept `async` for backwards compatibility: every wrapper below and its
 * callers `await` it. Resolution itself is synchronous now.
 */
export async function getClusterAsync(): Promise<ClusterService> {
  currentService ??= useMock ? mockService : httpService;
  return currentService;
}

export type { ClusterService, JobQuery, LogStreamStatus, Unsubscribe } from "./types";
export { ServiceError } from "./types";

// Async wrapper functions that use the resolved cluster service
export async function listJobs(query?: JobQuery): Promise<JobListResult> {
  const service = await getClusterAsync();
  return service.listJobs(query);
}

export async function getJob(id: string): Promise<JobState> {
  const service = await getClusterAsync();
  return service.getJob(id);
}

export async function createJob(spec: JobSpec): Promise<JobState> {
  const service = await getClusterAsync();
  return service.createJob(spec);
}

export async function retryJob(id: string): Promise<JobState> {
  const service = await getClusterAsync();
  return service.retryJob(id);
}

export async function cancelJob(id: string): Promise<JobState> {
  const service = await getClusterAsync();
  return service.cancelJob(id);
}

export async function deleteJob(id: string): Promise<void> {
  const service = await getClusterAsync();
  return service.deleteJob(id);
}

export async function getJobLogs(id: string): Promise<string[]> {
  const service = await getClusterAsync();
  return service.getJobLogs(id);
}

export async function streamJobLogs(
  id: string,
  onLine: (line: string) => void,
  onStatus: (status: LogStreamStatus) => void,
): Promise<Unsubscribe> {
  const service = await getClusterAsync();
  return service.streamJobLogs(id, onLine, onStatus);
}

export async function getJobMetrics(id: string): Promise<JobMetrics> {
  const service = await getClusterAsync();
  return service.getJobMetrics(id);
}

export async function listNodes(): Promise<NodeSpec[]> {
  const service = await getClusterAsync();
  return service.listNodes();
}

export async function getNode(id: string): Promise<NodeSpec> {
  const service = await getClusterAsync();
  return service.getNode(id);
}

export async function getNodeMetrics(id: string): Promise<JobMetrics> {
  const service = await getClusterAsync();
  return service.getNodeMetrics(id);
}

export async function validateToken(token: string): Promise<boolean> {
  const service = await getClusterAsync();
  return service.validateToken(token);
}
