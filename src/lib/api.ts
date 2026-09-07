import { jobs, logsFor, metricsFor, nodes, subscribeLogs } from "./mock-server";
import type { JobListResult, JobSpec, JobState, JobStatus, NodeSpec, JobMetrics } from "./types";
import { getSettings } from "./settings";

const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function requireToken() {
  const { token } = getSettings();
  if (!token) throw new ApiError(401, "Missing bearer token");
  return token;
}

export interface JobQuery {
  status?: JobStatus | "ALL";
  node?: string | "ALL";
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listJobs(q: JobQuery = {}): Promise<JobListResult> {
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
}

export async function getJob(id: string): Promise<JobState> {
  requireToken();
  await delay();
  const job = jobs.find((j) => j.job_id === id);
  if (!job) throw new ApiError(404, `Job ${id} not found`);
  return job;
}

export async function getJobMetrics(id: string): Promise<JobMetrics> {
  requireToken();
  await delay(320);
  return metricsFor(id);
}

export async function getJobLogs(id: string): Promise<string[]> {
  requireToken();
  await delay(200);
  return [...logsFor(id)];
}

export function streamJobLogs(
  id: string,
  onLine: (line: string) => void,
  onStatus: (s: "connecting" | "open" | "closed") => void,
) {
  return subscribeLogs(id, onLine, onStatus);
}

export async function createJob(spec: JobSpec): Promise<JobState> {
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
}

export async function retryJob(id: string): Promise<JobState> {
  requireToken();
  await delay(360);
  const job = await getJob(id);
  job.status = "PENDING";
  job.retry_count += 1;
  job.error = undefined;
  job.exit_code = undefined;
  job.completed_at = undefined;
  return job;
}

export async function cancelJob(id: string): Promise<JobState> {
  requireToken();
  await delay(360);
  const job = await getJob(id);
  job.status = "CANCELLED";
  job.completed_at = new Date().toISOString();
  return job;
}

export async function deleteJob(id: string): Promise<void> {
  requireToken();
  await delay(360);
  const i = jobs.findIndex((j) => j.job_id === id);
  if (i >= 0) jobs.splice(i, 1);
}

export async function listNodes(): Promise<NodeSpec[]> {
  requireToken();
  await delay();
  return nodes;
}

export async function getNode(id: string): Promise<NodeSpec> {
  requireToken();
  await delay();
  const node = nodes.find((n) => n.node_id === id);
  if (!node) throw new ApiError(404, `Node ${id} not found`);
  return node;
}

export async function validateToken(token: string): Promise<boolean> {
  await delay(500);
  return token.trim().length >= 8;
}
