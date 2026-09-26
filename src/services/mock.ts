/**
 * Mock implementation of ClusterService — runs the whole app without a backend.
 * Data lives in src/lib/mock-server.ts (in-memory, resets on reload).
 */
import { jobs, logsFor, metricsFor, nodes, subscribeLogs } from "@/lib/mock-server";
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

const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));

function createBackendError(
  status: number,
  detail: string,
  errorCode: string,
): BackendErrorResponse {
  return {
    status,
    title: getErrorTitle(status),
    detail,
    instance: "",
    error_code: errorCode,
  };
}

function getErrorTitle(status: number): string {
  switch (status) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 409:
      return "Conflict";
    case 422:
      return "Unprocessable Entity";
    case 500:
      return "Internal Server Error";
    case 503:
      return "Service Unavailable";
    default:
      return "Error";
  }
}

function requireToken() {
  const { token } = getSettings();
  if (!token) {
    const error = createBackendError(401, "Missing bearer token", "AUTH_TOKEN_MISSING");
    throw new ServiceError(401, "Missing bearer token", error);
  }
  return token;
}

export const mockService: ClusterService = {
  kind: "mock",

  async listJobs(q: JobQuery = {}): Promise<JobListResult> {
    requireToken();
    await delay();
    const limit = q.limit ?? 10;
    const offset = q.offset ?? 0;
    const filtered = jobs.filter((j) => {
      if (q.status && q.status !== "ALL" && j.status !== q.status) return false;
      if (q.node && q.node !== "ALL" && j.node_id !== q.node) return false;
      if (q.search) {
        const s = q.search.toLowerCase();
        if (!j.spec.name.toLowerCase().includes(s) && !j.job_id.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
    return { items: filtered.slice(offset, offset + limit), total: filtered.length };
  },

  async getJob(id: string): Promise<JobState> {
    requireToken();
    await delay();
    const job = jobs.find((j) => j.job_id === id);
    if (!job) {
      const error = createBackendError(404, `Job ${id} not found`, "JOB_NOT_FOUND");
      throw new ServiceError(404, `Job ${id} not found`, error);
    }
    return job;
  },

  async createJob(spec: JobSpec): Promise<JobState> {
    requireToken();
    await delay(520);
    const job: JobState = {
      job_id: `job-${1051 + jobs.filter((j) => j.job_id.startsWith("job-10")).length}`,
      spec,
      status: "PENDING",
      created_at: new Date().toISOString(),
      retry_count: 0,
    };
    jobs.unshift(job);
    return job;
  },

  async retryJob(id: string): Promise<JobState> {
    requireToken();
    await delay(360);
    const job = await mockService.getJob(id);
    job.status = "PENDING";
    job.retry_count += 1;
    job.error = undefined;
    job.exit_code = undefined;
    job.completed_at = undefined;
    return job;
  },

  async cancelJob(id: string): Promise<JobState> {
    requireToken();
    await delay(360);
    const job = await mockService.getJob(id);
    job.status = "CANCELLED";
    job.completed_at = new Date().toISOString();
    return job;
  },

  async deleteJob(id: string): Promise<void> {
    requireToken();
    await delay(360);
    const i = jobs.findIndex((j) => j.job_id === id);
    if (i >= 0) jobs.splice(i, 1);
  },

  async getJobLogs(id: string): Promise<string[]> {
    requireToken();
    await delay(200);
    return [...logsFor(id)];
  },

  streamJobLogs(
    id: string,
    onLine: (line: string) => void,
    onStatus: (status: LogStreamStatus) => void,
  ): Unsubscribe {
    return subscribeLogs(id, onLine, onStatus);
  },

  async getJobMetrics(id: string): Promise<JobMetrics> {
    requireToken();
    await delay(320);
    return metricsFor(id);
  },

  async listNodes(): Promise<NodeSpec[]> {
    requireToken();
    await delay();
    return nodes;
  },

  async getNode(id: string): Promise<NodeSpec> {
    requireToken();
    await delay();
    const node = nodes.find((n) => n.node_id === id);
    if (!node) {
      const error = createBackendError(404, `Node ${id} not found`, "NODE_NOT_FOUND");
      throw new ServiceError(404, `Node ${id} not found`, error);
    }
    return node;
  },

  async getNodeMetrics(id: string): Promise<JobMetrics> {
    requireToken();
    await delay(320);
    return metricsFor(`node:${id}`);
  },

  async validateToken(token: string): Promise<boolean> {
    await delay(500);
    return token.trim().length >= 8;
  },
};
