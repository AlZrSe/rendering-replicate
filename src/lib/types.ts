export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface JobSpec {
  name: string;
  command: string;
  working_dir?: string | undefined;
  env?: Record<string, string> | undefined;
  resources: {
    gpus: number;
    cpus: number;
    memory_gb: number;
  };
  paths: {
    input?: string | undefined;
    output?: string | undefined;
  };
  retry?: {
    max_retries: number;
    retry_delay_seconds: number;
  };
}

export interface JobState {
  job_id: string;
  spec: JobSpec;
  status: JobStatus;
  node_id?: string | undefined;
  created_at: string;
  started_at?: string | undefined;
  completed_at?: string | undefined;
  exit_code?: number | undefined;
  error?: string | undefined;
  retry_count: number;
}

export interface NodeSpec {
  node_id: string;
  hostname: string;
  gpus: Array<{ name: string; memory_gb: number }>;
  cpus: number;
  memory_gb: number;
  os: string;
  status: "ONLINE" | "OFFLINE";
  last_heartbeat: string;
  current_job_id?: string | undefined;
}

export interface GPUMetric {
  timestamp: string;
  gpu_index: number;
  memory_used_mb: number;
  memory_total_mb: number;
  utilization_percent: number;
  temperature_c: number;
}

export interface CPUMetric {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
}

export interface JobMetrics {
  job_id: string;
  gpu_metrics: GPUMetric[];
  cpu_metrics: CPUMetric[];
  summary: {
    gpu_memory_min_mb: number;
    gpu_memory_max_mb: number;
    gpu_memory_avg_mb: number;
    gpu_util_min: number;
    gpu_util_max: number;
    gpu_util_avg: number;
    cpu_avg_percent: number;
  };
}

export interface JobListResult {
  items: JobState[];
  total: number;
}
