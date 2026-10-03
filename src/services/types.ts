import type {
  JobListResult,
  JobMetrics,
  JobSpec,
  JobState,
  JobStatus,
  NodeSpec,
} from "@/lib/types";

export interface JobQuery {
  status?: JobStatus | "ALL";
  node?: string | "ALL";
  search?: string;
  limit?: number;
  offset?: number;
}

export type LogStreamStatus = "connecting" | "open" | "closed";

/** Unsubscribe from a log stream. */
export type Unsubscribe = () => void;

/**
 * Backend error response format (matches ErrorResponse model).
 */
export interface BackendErrorResponse {
  status: number;
  title: string;
  detail: string;
  instance: string;
  error_code: string;
}

/**
 * The single contract between the UI and the cluster backend.
 * Every backend call in the app goes through this interface, so the whole
 * app can run against the mock implementation with no server present.
 */
export interface ClusterService {
  /** Human-readable name of the active implementation ("mock" | "http"). */
  readonly kind: "mock" | "http";

  listJobs(query?: JobQuery): Promise<JobListResult>;
  getJob(id: string): Promise<JobState>;
  createJob(spec: JobSpec): Promise<JobState>;
  retryJob(id: string): Promise<JobState>;
  cancelJob(id: string): Promise<JobState>;
  deleteJob(id: string): Promise<void>;

  getJobLogs(id: string): Promise<string[]>;
  streamJobLogs(
    id: string,
    onLine: (line: string) => void,
    onStatus: (status: LogStreamStatus) => void,
  ): Unsubscribe;
  getJobMetrics(id: string): Promise<JobMetrics>;

  listNodes(): Promise<NodeSpec[]>;
  getNode(id: string): Promise<NodeSpec>;
  getNodeMetrics(id: string): Promise<JobMetrics>;

  validateToken(token: string): Promise<boolean>;
}

export class ServiceError extends Error {
  /**
   * The HTTP status from the backend, or `0` when no HTTP response was
   * produced at all — a network failure, a wrong base URL, a CORS rejection
   * (see `unreachable()` in ./http.ts). `0` is deliberately below every
   * branch in `useErrorHandler`, so an unreachable backend lands in the
   * generic handler and its connection-specific `error_code` message, rather
   * than being mistaken for a rejected request.
   */
  status: number;
  error_code?: string;
  title?: string;
  detail?: string;

  constructor(status: number, message: string, backendError?: BackendErrorResponse) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    if (backendError) {
      this.error_code = backendError.error_code;
      this.title = backendError.title;
      this.detail = backendError.detail;
    }
  }
}
