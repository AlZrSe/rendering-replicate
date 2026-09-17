/**
 * Real backend implementation of ClusterService (FastAPI cluster API).
 * Not active until VITE_CLUSTER_BACKEND=http is set; the mock is the default.
 */
import type { JobListResult, JobMetrics, JobSpec, JobState, NodeSpec } from "@/lib/types";
import { getSettings } from "@/lib/settings";
import type { ClusterService, JobQuery, LogStreamStatus, Unsubscribe } from "./types";
import { ServiceError } from "./types";

function base() {
  return getSettings().apiBaseUrl.replace(/\/+$/, "");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = getSettings();
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new ServiceError(res.status, `${init.method ?? "GET"} ${path} failed`);
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

  async validateToken(token: string) {
    try {
      const res = await fetch(`${base()}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
