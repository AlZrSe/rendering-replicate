/**
 * Real backend implementation of ClusterService (FastAPI cluster API).
 * This is the implementation that runs unless VITE_CLUSTER_BACKEND is exactly
 * "mock" — see ./index.ts, which owns that decision.
 */
import type { JobListResult, JobMetrics, JobSpec, JobState, NodeSpec } from "@/lib/types";
import { getSettings } from "@/lib/settings";
import type {
  ClusterService,
  JobQuery,
  LogStreamStatus,
  Unsubscribe,
  BackendErrorResponse,
} from "./types";
import { ServiceError } from "./types";

function base() {
  return getSettings().apiBaseUrl.replace(/\/+$/, "");
}

/**
 * A `fetch` rejection means no HTTP response was produced at all: the backend
 * is down, the base URL is wrong, or CORS refused the request. There is no
 * status to report, so we use `0` (the "no response" sentinel documented on
 * ServiceError.status) plus a distinct `error_code`, which is what the UI keys
 * off to show a connection message instead of blaming the request.
 */
function unreachable(what: string, cause: unknown): ServiceError {
  const causeText = cause instanceof Error ? cause.message : String(cause);
  // In dev/test the cause is folded into the message too, because that is what
  // a failing assertion prints. `detail` alone sends the reader hunting for a
  // backend problem when the real cause was, say, a stub with no matching
  // fixture. Production keeps the short message the UI shows.
  const message = import.meta.env.DEV
    ? `${what} failed: backend unreachable (${causeText})`
    : `${what} failed: backend unreachable`;
  const error = new ServiceError(0, message);
  error.error_code = "BACKEND_UNREACHABLE";
  error.title = "Backend unreachable";
  error.detail = causeText;
  return error;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = getSettings();
  const what = `${init.method ?? "GET"} ${path}`;
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (cause) {
    throw unreachable(what, cause);
  }
  if (!res.ok) {
    let backendError: BackendErrorResponse | undefined;
    try {
      const errorData = await res.json();
      if (errorData.error_code) {
        backendError = errorData as BackendErrorResponse;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new ServiceError(res.status, `${what} failed`, backendError);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function query(q: JobQuery) {
  const p = new URLSearchParams();
  if (q.status && q.status !== "ALL") p.set("status", q.status);
  if (q.node && q.node !== "ALL") p.set("node_id", q.node);
  if (q.search) p.set("search", q.search);
  p.set("limit", String(q.limit ?? 10));
  p.set("offset", String(q.offset ?? 0));
  return `?${p.toString()}`;
}

export const httpService: ClusterService = {
  kind: "http",

  listJobs: (q: JobQuery = {}) => request<JobListResult>(`/jobs${query(q)}`),
  getJob: (id) => request<JobState>(`/jobs/${id}`),
  createJob: (spec: JobSpec) =>
    request<JobState>("/jobs", { method: "POST", body: JSON.stringify(spec) }),
  retryJob: (id) => request<JobState>(`/jobs/${id}/retry`, { method: "POST" }),
  cancelJob: (id) => request<JobState>(`/jobs/${id}/cancel`, { method: "POST" }),
  deleteJob: (id) => request<void>(`/jobs/${id}`, { method: "DELETE" }),

  getJobLogs: (id) => request<string[]>(`/jobs/${id}/logs/history`),

  streamJobLogs(
    id: string,
    onLine: (line: string) => void,
    onStatus: (status: LogStreamStatus) => void,
  ): Unsubscribe {
    if (typeof window === "undefined") return () => {};
    const url = `${base().replace(/^http/, "ws")}/jobs/${id}/logs`;
    onStatus("connecting");
    const socket = new WebSocket(url);
    socket.onopen = () => onStatus("open");
    socket.onmessage = (e) => onLine(String(e.data));
    socket.onclose = () => onStatus("closed");
    socket.onerror = () => onStatus("closed");
    return () => socket.close();
  },

  getJobMetrics: (id) => request<JobMetrics>(`/jobs/${id}/metrics`),

  listNodes: () => request<NodeSpec[]>("/nodes"),
  getNode: (id) => request<NodeSpec>(`/nodes/${id}`),
  getNodeMetrics: (id) => request<JobMetrics>(`/nodes/${id}/metrics`),

  /**
   * Returns a verdict on the token only. An unreachable backend is *not* a
   * verdict — it throws, so the login form can say "cannot reach the backend"
   * instead of accusing a token that may be perfectly good.
   */
  async validateToken(token: string) {
    try {
      const res = await fetch(`${base()}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch (cause) {
      throw unreachable("GET /auth/verify", cause);
    }
  },
};
