import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { MetricChart } from "@/components/MetricChart";
import { LogViewer } from "@/components/LogViewer";
import { YamlBlock } from "@/components/YamlBlock";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cancelJob, deleteJob, getJob, getJobLogs, getJobMetrics, retryJob, streamJobLogs } from "@/lib/api";
import { fmtDate, fmtDuration, fmtGb, toYaml } from "@/lib/format";
import { useSettings } from "@/lib/settings";

export const Route = createFileRoute("/jobs/$jobId")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.jobId} · Scientific Home Cluster` },
      {
        name: "description",
        content: `Live logs, GPU and CPU metrics, spec and controls for cluster job ${params.jobId}.`,
      },
      { property: "og:title", content: `${params.jobId} · Scientific Home Cluster` },
      {
        property: "og:description",
        content: "Stream job logs and inspect GPU/CPU metrics for a scientific compute job.",
      },
    ],
  }),
  component: JobDetailPage,
});

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { settings } = useSettings();
  const [dialog, setDialog] = useState<"retry" | "cancel" | "delete" | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [conn, setConn] = useState<"connecting" | "open" | "closed">("connecting");

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId),
    refetchInterval: settings.pollIntervalMs,
  });
  const metricsQuery = useQuery({
    queryKey: ["job-metrics", jobId],
    queryFn: () => getJobMetrics(jobId),
  });

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    getJobLogs(jobId)
      .then((initial) => {
        if (cancelled) return;
        setLines(initial);
        stop = streamJobLogs(jobId, (line) => setLines((prev) => [...prev, line]), setConn);
      })
      .catch(() => setConn("closed"));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [jobId]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["job", jobId] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };

  const retry = useMutation({
    mutationFn: () => retryJob(jobId),
    onSuccess: () => {
      invalidate();
      toast.success("Job re-queued");
    },
  });
  const cancel = useMutation({
    mutationFn: () => cancelJob(jobId),
    onSuccess: () => {
      invalidate();
      toast.success("Job cancelled");
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteJob(jobId),
    onSuccess: () => {
      invalidate();
      toast.success("Job deleted");
      navigate({ to: "/" });
    },
  });

  const job = jobQuery.data;
  const metrics = metricsQuery.data;

  const gpuData = (metrics?.gpu_metrics ?? []).map((m) => ({
    timestamp: m.timestamp,
    utilization_percent: m.utilization_percent,
    temperature_c: m.temperature_c,
    memory_used_gb: Number((m.memory_used_mb / 1024).toFixed(2)),
  }));
  const cpuData = (metrics?.cpu_metrics ?? []).map((m) => ({
    timestamp: m.timestamp,
    cpu_percent: m.cpu_percent,
    memory_percent: m.memory_percent,
  }));

  return (
    <Shell
      title={job?.spec.name ?? jobId}
      subtitle={`GET /jobs/${jobId}`}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" /> Jobs
          </Link>
        </Button>
      }
    >
      {jobQuery.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : jobQuery.isError || !job ? (
        <div className="panel p-8 text-center">
          <p className="text-sm text-muted-foreground">Job {jobId} could not be loaded.</p>
        </div>
      ) : (
        <>
          <div className="panel flex flex-wrap items-center gap-x-8 gap-y-4 p-4">
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Status</p>
              <div className="mt-1.5">
                <StatusBadge status={job.status} />
              </div>
            </div>
            <Field label="Node" value={job.node_id ?? "unassigned"} />
            <Field label="Created" value={fmtDate(job.created_at)} />
            <Field label="Started" value={fmtDate(job.started_at)} />
            <Field label="Runtime" value={fmtDuration(job.started_at, job.completed_at)} />
            <Field label="Retries" value={String(job.retry_count)} />
            {job.exit_code !== undefined && (
              <Field label="Exit code" value={String(job.exit_code)} />
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialog("retry")}
                disabled={job.status === "RUNNING" || retry.isPending}
              >
                <RotateCcw className="size-4" /> Retry
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialog("cancel")}
                disabled={job.status !== "RUNNING" && job.status !== "PENDING"}
              >
                <Ban className="size-4" /> Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDialog("delete")}>
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          </div>

          {job.error && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 font-mono text-xs text-destructive">
              {job.error}
            </div>
          )}

          <Tabs defaultValue="overview" className="mt-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
              <YamlBlock yaml={toYaml(job.spec)} filename="job.yaml" />
              <YamlBlock
                yaml={toYaml({
                  job_id: job.job_id,
                  status: job.status,
                  node_id: job.node_id,
                  created_at: job.created_at,
                  started_at: job.started_at,
                  completed_at: job.completed_at,
                  exit_code: job.exit_code,
                  retry_count: job.retry_count,
                })}
                filename="state.yaml"
              />
              <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
                <MetricCard label="GPUs requested" value={job.spec.resources.gpus} />
                <MetricCard label="CPU cores" value={job.spec.resources.cpus} />
                <MetricCard label="Memory" value={`${job.spec.resources.memory_gb} GB`} />
                {(job.spec.resources.vram_gb ?? 0) > 0 && (
                  <MetricCard
                    label="VRAM per GPU"
                    value={`${job.spec.resources.vram_gb} GB`}
                  />
                )}
                <MetricCard
                  label="Max retries"
                  value={job.spec.retry?.max_retries ?? 0}
                  hint={`delay ${job.spec.retry?.retry_delay_seconds ?? 0}s`}
                />
              </div>
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <LogViewer lines={lines} connection={conn} jobId={jobId} />
            </TabsContent>

            <TabsContent value="metrics" className="mt-4 space-y-4">
              {metricsQuery.isPending || !metrics ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <MetricCard
                      label="GPU util avg"
                      value={`${metrics.summary.gpu_util_avg}%`}
                      hint={`peak ${metrics.summary.gpu_util_max}%`}
                      tone="info"
                    />
                    <MetricCard
                      label="GPU memory peak"
                      value={fmtGb(metrics.summary.gpu_memory_max_mb)}
                      hint={`avg ${fmtGb(metrics.summary.gpu_memory_avg_mb)}`}
                    />
                    <MetricCard
                      label="CPU avg"
                      value={`${metrics.summary.cpu_avg_percent}%`}
                      tone="success"
                    />
                    <MetricCard
                      label="Samples"
                      value={metrics.gpu_metrics.length}
                      hint="30s resolution"
                    />
                  </div>
                  <div className="panel p-4">
                    <h3 className="mb-2 text-sm font-semibold">GPU utilisation & temperature</h3>
                    <MetricChart
                      data={gpuData}
                      series={[
                        {
                          key: "utilization_percent",
                          label: "Utilisation",
                          color: "var(--color-chart-1)",
                          unit: "%",
                        },
                        {
                          key: "temperature_c",
                          label: "Temperature",
                          color: "var(--color-chart-4)",
                          unit: "°C",
                        },
                      ]}
                    />
                  </div>
                  <div className="panel p-4">
                    <h3 className="mb-2 text-sm font-semibold">GPU memory</h3>
                    <MetricChart
                      data={gpuData}
                      series={[
                        {
                          key: "memory_used_gb",
                          label: "VRAM used",
                          color: "var(--color-chart-2)",
                          unit: " GB",
                        },
                      ]}
                    />
                  </div>
                  <div className="panel p-4">
                    <h3 className="mb-2 text-sm font-semibold">CPU & system memory</h3>
                    <MetricChart
                      data={cpuData}
                      domain={[0, 100]}
                      series={[
                        { key: "cpu_percent", label: "CPU", color: "var(--color-chart-3)", unit: "%" },
                        {
                          key: "memory_percent",
                          label: "RAM",
                          color: "var(--color-chart-5)",
                          unit: "%",
                        },
                      ]}
                    />
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <ConfirmModal
        open={dialog === "retry"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Retry this job?"
        description="The job is put back in the queue and will be re-scheduled on the next available node."
        confirmLabel="Retry job"
        onConfirm={() => retry.mutate()}
      />
      <ConfirmModal
        open={dialog === "cancel"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Cancel this job?"
        description="The running process is terminated on the assigned node. Partial output stays in the output folder."
        confirmLabel="Cancel job"
        destructive
        onConfirm={() => cancel.mutate()}
      />
      <ConfirmModal
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Delete this job?"
        description="The job record and its logs are removed permanently. This cannot be undone."
        confirmLabel="Delete job"
        destructive
        onConfirm={() => remove.mutate()}
      />
    </Shell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1.5 font-mono text-sm">{value}</p>
    </div>
  );
}
