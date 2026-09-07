/**
 * In-memory mock of the FastAPI cluster backend.
 * Swap this out for real fetch calls in src/lib/api.ts once the backend exists.
 */
import type {
  CPUMetric,
  GPUMetric,
  JobMetrics,
  JobSpec,
  JobState,
  JobStatus,
  NodeSpec,
} from "./types";

let seed = 1337;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

export const nodes: NodeSpec[] = [
  {
    node_id: "node-alpha",
    hostname: "alpha.lan",
    gpus: [{ name: "NVIDIA RTX 4090", memory_gb: 24 }],
    cpus: 16,
    memory_gb: 64,
    os: "Ubuntu 24.04",
    status: "ONLINE",
    last_heartbeat: iso(4_000),
    current_job_id: "job-1041",
  },
  {
    node_id: "node-beta",
    hostname: "beta.lan",
    gpus: [
      { name: "NVIDIA RTX 3090", memory_gb: 24 },
      { name: "NVIDIA RTX 3090", memory_gb: 24 },
    ],
    cpus: 24,
    memory_gb: 128,
    os: "Ubuntu 22.04",
    status: "ONLINE",
    last_heartbeat: iso(11_000),
    current_job_id: "job-1039",
  },
  {
    node_id: "node-gamma",
    hostname: "gamma.lan",
    gpus: [{ name: "Apple M3 Max (MPS)", memory_gb: 36 }],
    cpus: 14,
    memory_gb: 36,
    os: "macOS 15.3",
    status: "ONLINE",
    last_heartbeat: iso(28_000),
  },
  {
    node_id: "node-delta",
    hostname: "delta.lan",
    gpus: [],
    cpus: 8,
    memory_gb: 32,
    os: "Debian 12",
    status: "OFFLINE",
    last_heartbeat: iso(1_400_000),
  },
];

const names = [
  "protein-fold-batch",
  "cfd-mesh-sweep",
  "mnist-ablation",
  "genome-align",
  "monte-carlo-photon",
  "spectra-denoise",
  "lattice-qcd-run",
  "climate-downscale",
  "docking-screen",
  "raman-classifier",
];

const statuses: JobStatus[] = [
  "RUNNING",
  "RUNNING",
  "PENDING",
  "COMPLETED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "COMPLETED",
  "PENDING",
  "RUNNING",
];

function makeSpec(name: string): JobSpec {
  return {
    name,
    command: `python -u scripts/${name.replace(/-/g, "_")}.py --config configs/${name}.yaml`,
    working_dir: `/sync/projects/${name}`,
    env: { PYTHONUNBUFFERED: "1", CUDA_VISIBLE_DEVICES: "0" },
    resources: {
      gpus: Math.floor(rand() * 2) + 1,
      cpus: [4, 8, 12, 16][Math.floor(rand() * 4)]!,
      memory_gb: [8, 16, 32, 64][Math.floor(rand() * 4)]!,
    },
    paths: { input: `data/${name}/in`, output: `data/${name}/out` },
    retry: { max_retries: 3, retry_delay_seconds: 60 },
  };
}

export const jobs: JobState[] = names.map((name, i) => {
  const status = statuses[i]!;
  const created = 1000 * 60 * (12 + i * 47);
  const running = status !== "PENDING";
  const done = status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";
  return {
    job_id: `job-${1050 - i}`,
    spec: makeSpec(name),
    status,
    node_id: running ? pick(nodes.slice(0, 3)).node_id : undefined,
    created_at: iso(created),
    started_at: running ? iso(created - 1000 * 60 * 3) : undefined,
    completed_at: done ? iso(created - 1000 * 60 * 40) : undefined,
    exit_code: status === "COMPLETED" ? 0 : status === "FAILED" ? 137 : undefined,
    error: status === "FAILED" ? "CUDA out of memory at step 12841" : undefined,
    retry_count: status === "FAILED" ? 2 : 0,
  };
});

/* ---------------- metrics ---------------- */

const metricsCache = new Map<string, JobMetrics>();

export function metricsFor(jobId: string): JobMetrics {
  const cached = metricsCache.get(jobId);
  if (cached) return cached;
  const gpu_metrics: GPUMetric[] = [];
  const cpu_metrics: CPUMetric[] = [];
  const total = 24_576;
  let util = 55;
  let mem = 9_000;
  let cpu = 30;
  for (let i = 120; i >= 0; i--) {
    util = Math.min(99, Math.max(6, util + (rand() - 0.5) * 18));
    mem = Math.min(total, Math.max(1200, mem + (rand() - 0.45) * 900));
    cpu = Math.min(100, Math.max(4, cpu + (rand() - 0.5) * 14));
    const timestamp = iso(i * 30_000);
    gpu_metrics.push({
      timestamp,
      gpu_index: 0,
      memory_used_mb: Math.round(mem),
      memory_total_mb: total,
      utilization_percent: Math.round(util),
      temperature_c: Math.round(48 + util * 0.28),
    });
    cpu_metrics.push({
      timestamp,
      cpu_percent: Math.round(cpu),
      memory_percent: Math.round(30 + cpu * 0.4),
    });
  }
  const mems = gpu_metrics.map((m) => m.memory_used_mb);
  const utils = gpu_metrics.map((m) => m.utilization_percent);
  const avg = (a: number[]) => Math.round(a.reduce((s, v) => s + v, 0) / a.length);
  const result: JobMetrics = {
    job_id: jobId,
    gpu_metrics,
    cpu_metrics,
    summary: {
      gpu_memory_min_mb: Math.min(...mems),
      gpu_memory_max_mb: Math.max(...mems),
      gpu_memory_avg_mb: avg(mems),
      gpu_util_min: Math.min(...utils),
      gpu_util_max: Math.max(...utils),
      gpu_util_avg: avg(utils),
      cpu_avg_percent: avg(cpu_metrics.map((m) => m.cpu_percent)),
    },
  };
  metricsCache.set(jobId, result);
  return result;
}

/* ---------------- log stream ---------------- */

const logHistory = new Map<string, string[]>();

function stamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

const logTemplates = [
  (s: number) => `INFO  step=${s} loss=${(2.4 - s * 0.0007).toFixed(4)} lr=3.0e-4`,
  (s: number) => `INFO  step=${s} throughput=${(180 + rand() * 40).toFixed(1)} samples/s`,
  (s: number) => `DEBUG allocator: reserved=${(8 + rand() * 6).toFixed(2)} GiB step=${s}`,
  (s: number) => `INFO  checkpoint written to data/out/ckpt-${s}.pt`,
  () => `WARN  syncthing folder scan delayed by 1.4s`,
];

export function logsFor(jobId: string): string[] {
  let lines = logHistory.get(jobId);
  if (!lines) {
    lines = [
      `${stamp()} INFO  job ${jobId} accepted by scheduler`,
      `${stamp()} INFO  syncing input folder via syncthing (device alpha)`,
      `${stamp()} INFO  environment ready: python 3.12.4, torch 2.6.0+cu124`,
      `${stamp()} INFO  starting command`,
    ];
    for (let i = 0; i < 60; i++) {
      lines.push(`${stamp()} ${pick(logTemplates)(1000 + i * 50)}`);
    }
    logHistory.set(jobId, lines);
  }
  return lines;
}

/**
 * Mock of `GET /jobs/{id}/logs` (WebSocket). Emits appended lines while the job runs.
 */
export function subscribeLogs(
  jobId: string,
  onLine: (line: string) => void,
  onStatus: (s: "connecting" | "open" | "closed") => void,
) {
  let step = 5000;
  let timer: ReturnType<typeof setInterval> | undefined;
  onStatus("connecting");
  const openTimer = setTimeout(() => {
    onStatus("open");
    timer = setInterval(() => {
      const job = jobs.find((j) => j.job_id === jobId);
      if (!job || job.status !== "RUNNING") return;
      step += 50;
      const line = `${stamp()} ${pick(logTemplates)(step)}`;
      logsFor(jobId).push(line);
      onLine(line);
    }, 1400);
  }, 450);
  return () => {
    clearTimeout(openTimer);
    if (timer) clearInterval(timer);
    onStatus("closed");
  };
}
