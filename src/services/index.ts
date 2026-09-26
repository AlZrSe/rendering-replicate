/**
 * Services layer: the app's only door to the backend.
 *
 * Components never call fetch/WebSocket directly — they import `cluster`
 * (or the named helpers below). The mock implementation is used as fallback
 * when the backend is not reachable; set VITE_CLUSTER_BACKEND=http to force
 * real backend usage, or leave unset to auto-detect backend availability.
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

const configured = import.meta.env["VITE_CLUSTER_BACKEND"] as string | undefined;

// Check for localStorage override
const forceHttpBackend =
  typeof window !== "undefined" && window.localStorage.getItem("shc.forceHttpBackend") === "true";

// Cache the backend reachability check
let backendReachable: boolean | null = null;
let currentService: ClusterService | null = null;

// Allow forcing a re-check of backend reachability (e.g., if backend starts later)
export function resetBackendReachabilityCache() {
  backendReachable = null;
  currentService = null;
  clusterPromise = null;
}

async function checkBackendReachable(): Promise<boolean> {
  if (backendReachable !== null) {
    console.debug("Backend reachability cached:", backendReachable);
    return backendReachable;
  }

  const { getSettings } = await import("@/lib/settings");
  const apiBaseUrl = getSettings().apiBaseUrl;
  const healthUrl = `${apiBaseUrl.replace(/\/+$/, "")}/health`;

  // Try up to 2 times with a small delay
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      console.debug(`Backend health check attempt ${attempt + 1}: ${healthUrl}`);

      const res = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
        credentials: "include",
      });

      clearTimeout(timeout);
      if (res.ok) {
        backendReachable = true;
        console.debug(
          `Backend health check success: ${res.ok} (status: ${res.status}, url: ${healthUrl})`,
        );
        return true;
      }
      console.debug(`Backend health check failed: ${res.status} (url: ${healthUrl})`);
    } catch (error) {
      console.debug(`Backend health check error:`, error);
    }

    if (attempt === 0) {
      // Wait briefly before retry
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  backendReachable = false;
  console.debug("Backend health check failed after all attempts");
  return false;
}

async function getClusterService(): Promise<ClusterService> {
  if (currentService !== null) {
    return currentService;
  }

  // If explicitly configured to use http, use http service
  if (configured === "http" || forceHttpBackend) {
    currentService = httpService;
    console.debug("Using HTTP backend (forced via env or localStorage)");
    return currentService;
  }

  // Auto-detect: check if backend is reachable
  const reachable = await checkBackendReachable();
  currentService = reachable ? httpService : mockService;
  console.debug("Auto-detected backend:", currentService.kind);
  return currentService;
}

// Initialize the service
let clusterPromise: Promise<ClusterService> | null = null;

function getCluster(): ClusterService {
  // This is a sync getter for backward compatibility
  // It will return mock initially if not initialized, then update after async check
  if (currentService !== null) {
    return currentService;
  }

  // Start async initialization
  if (clusterPromise === null) {
    clusterPromise = getClusterService();
  }

  // Return mock as default synchronous fallback
  // The async functions will use the real service once resolved
  return mockService;
}

// Export a getter that can be awaited
export async function getClusterAsync(): Promise<ClusterService> {
  if (currentService !== null) {
    console.debug("getClusterAsync: returning cached service", currentService.kind);
    return currentService;
  }
  if (clusterPromise === null) {
    console.debug("getClusterAsync: starting service resolution");
    clusterPromise = getClusterService();
  }
  const service = await clusterPromise;
  console.debug("getClusterAsync: resolved service", service.kind);
  return service;
}

// Re-export the services
export { mockService, httpService };
export type { ClusterService, JobQuery, LogStreamStatus, Unsubscribe } from "./types";
export { ServiceError } from "./types";

// Async wrapper functions that use the resolved cluster service
export async function listJobs(query?: JobQuery): Promise<JobListResult> {
  const service = await getClusterAsync();
  console.debug("listJobs: using service", service.kind);
  return service.listJobs(query);
}

export async function getJob(id: string): Promise<JobState> {
  const service = await getClusterAsync();
  console.debug("getJob: using service", service.kind);
  return service.getJob(id);
}

export async function createJob(spec: JobSpec): Promise<JobState> {
  const service = await getClusterAsync();
  console.debug("createJob: using service", service.kind);
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
