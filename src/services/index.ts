/**
 * Services layer: the app's only door to the backend.
 *
 * Components never call fetch/WebSocket directly — they import `cluster`
 * (or the named helpers below). The mock implementation is used by default so
 * the whole app runs without a server; set VITE_CLUSTER_BACKEND=http to talk
 * to the real FastAPI backend at Settings → API base URL.
 */
import { mockService } from "./mock";
import { httpService } from "./http";
import type { ClusterService } from "./types";

const configured = import.meta.env["VITE_CLUSTER_BACKEND"] as string | undefined;

export const cluster: ClusterService = configured === "http" ? httpService : mockService;

export const isMockBackend = cluster.kind === "mock";

export const listJobs: ClusterService["listJobs"] = (q) => cluster.listJobs(q);
export const getJob: ClusterService["getJob"] = (id) => cluster.getJob(id);
export const createJob: ClusterService["createJob"] = (spec) => cluster.createJob(spec);
export const retryJob: ClusterService["retryJob"] = (id) => cluster.retryJob(id);
export const cancelJob: ClusterService["cancelJob"] = (id) => cluster.cancelJob(id);
export const deleteJob: ClusterService["deleteJob"] = (id) => cluster.deleteJob(id);
export const getJobLogs: ClusterService["getJobLogs"] = (id) => cluster.getJobLogs(id);
export const streamJobLogs: ClusterService["streamJobLogs"] = (id, onLine, onStatus) =>
  cluster.streamJobLogs(id, onLine, onStatus);
export const getJobMetrics: ClusterService["getJobMetrics"] = (id) => cluster.getJobMetrics(id);
export const listNodes: ClusterService["listNodes"] = () => cluster.listNodes();
export const getNode: ClusterService["getNode"] = (id) => cluster.getNode(id);
export const getNodeMetrics: ClusterService["getNodeMetrics"] = (id) => cluster.getNodeMetrics(id);
export const validateToken: ClusterService["validateToken"] = (t) => cluster.validateToken(t);

export { mockService, httpService };
export type { ClusterService, JobQuery, LogStreamStatus, Unsubscribe } from "./types";
export { ServiceError } from "./types";
