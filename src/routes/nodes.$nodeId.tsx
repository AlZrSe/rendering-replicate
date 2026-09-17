import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { NodeStatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { MetricChart } from "@/components/MetricChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getNode, getNodeMetrics } from "@/services";
import { fmtAgo, fmtDate } from "@/lib/format";
import { useSettings } from "@/lib/settings";

export const Route = createFileRoute("/nodes/$nodeId")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.nodeId} · Scientific Home Cluster` },
      {
        name: "description",
        content: `Hardware specs, current job, GPU/CPU history and heartbeat timeline for node ${params.nodeId}.`,
      },
      { property: "og:title", content: `${params.nodeId} · Scientific Home Cluster` },
      {
        property: "og:description",
        content: "Inspect a cluster machine's specs, load history and heartbeats.",
      },
    ],
  }),
  component: NodeDetailPage,
});

function NodeDetailPage() {
  const { nodeId } = Route.useParams();
  const { settings } = useSettings();

  const nodeQuery = useQuery({
    queryKey: ["node", nodeId],
    queryFn: () => getNode(nodeId),
    refetchInterval: settings.pollIntervalMs,
  });
  const node = nodeQuery.data;

  const metricsQuery = useQuery({
    queryKey: ["node-metrics", nodeId],
    queryFn: () => getNodeMetrics(nodeId),
  });

  const gpuData = (metricsQuery.data?.gpu_metrics ?? []).map((m) => ({
    timestamp: m.timestamp,
    utilization_percent: m.utilization_percent,
    memory_used_gb: Number((m.memory_used_mb / 1024).toFixed(2)),
  }));
  const cpuData = (metricsQuery.data?.cpu_metrics ?? []).map((m) => ({
    timestamp: m.timestamp,
    cpu_percent: m.cpu_percent,
    memory_percent: m.memory_percent,
  }));

  const heartbeats = (metricsQuery.data?.cpu_metrics ?? []).slice(-24);

  return (
    <Shell
      title={node?.node_id ?? nodeId}
      subtitle={node ? node.hostname : `GET /nodes/${nodeId}`}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/nodes">
            <ArrowLeft className="size-4" /> Nodes
          </Link>
        </Button>
      }
    >
      {nodeQuery.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : nodeQuery.isError || !node ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          Node {nodeId} could not be loaded.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Status</p>
              <div className="mt-2">
                <NodeStatusBadge status={node.status} lastHeartbeat={node.last_heartbeat} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                heartbeat {fmtAgo(node.last_heartbeat)}
              </p>
            </div>
            <MetricCard label="CPU cores" value={node.cpus} hint={node.os} />
            <MetricCard label="Memory" value={`${node.memory_gb} GB`} />
            <div className="panel p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Current job</p>
              {node.current_job_id ? (
                <Link
                  to="/jobs/$jobId"
                  params={{ jobId: node.current_job_id }}
                  className="mt-2 block font-mono text-sm text-primary hover:underline"
                >
                  {node.current_job_id}
                </Link>
              ) : (
                <p className="mt-2 font-mono text-sm text-muted-foreground">idle</p>
              )}
            </div>
          </div>

          <div className="panel mt-4 p-4">
            <h2 className="text-sm font-semibold">Hardware</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <Spec label="Hostname" value={node.hostname} />
              <Spec label="Operating system" value={node.os} />
              <Spec
                label="GPUs"
                value={
                  node.gpus.length
                    ? node.gpus.map((g) => `${g.name} · ${g.memory_gb} GB VRAM`).join(" | ")
                    : "none"
                }
              />
              <Spec label="Last heartbeat" value={fmtDate(node.last_heartbeat)} />
            </dl>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="panel p-4">
              <h2 className="mb-2 text-sm font-semibold">GPU history</h2>
              {metricsQuery.isPending ? (
                <Skeleton className="h-52 w-full" />
              ) : (
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
                      key: "memory_used_gb",
                      label: "VRAM",
                      color: "var(--color-chart-2)",
                      unit: " GB",
                    },
                  ]}
                />
              )}
            </div>
            <div className="panel p-4">
              <h2 className="mb-2 text-sm font-semibold">CPU history</h2>
              {metricsQuery.isPending ? (
                <Skeleton className="h-52 w-full" />
              ) : (
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
              )}
            </div>
          </div>

          <div className="panel mt-4 p-4">
            <h2 className="text-sm font-semibold">Heartbeat timeline</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {heartbeats.map((h, i) => (
                <span
                  key={i}
                  title={fmtDate(h.timestamp)}
                  className={
                    node.status === "OFFLINE" && i > heartbeats.length - 4
                      ? "h-8 w-3 rounded-sm bg-destructive/70"
                      : "h-8 w-3 rounded-sm bg-success/70"
                  }
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Last {heartbeats.length} heartbeats, newest on the right.
            </p>
          </div>
        </>
      )}
    </Shell>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-sm break-words">{value}</dd>
    </div>
  );
}
