import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Inbox, Plus, RefreshCw, Search } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listJobs, listNodes } from "@/lib/api";
import { fmtAgo, fmtDuration } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import type { JobStatus } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jobs · Scientific Home Cluster" },
      {
        name: "description",
        content:
          "Monitor distributed scientific compute jobs across your home cluster: status, node assignment, GPU and CPU load in real time.",
      },
      { property: "og:title", content: "Jobs · Scientific Home Cluster" },
      {
        property: "og:description",
        content: "Live dashboard for distributed scientific compute jobs and cluster nodes.",
      },
    ],
  }),
  component: JobsPage,
});

const STATUSES: Array<JobStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];
const PAGE_SIZE = 6;

function JobsPage() {
  const { settings } = useSettings();
  const [status, setStatus] = useState<JobStatus | "ALL">("ALL");
  const [node, setNode] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const nodesQuery = useQuery({ queryKey: ["nodes"], queryFn: listNodes });
  const jobsQuery = useQuery({
    queryKey: ["jobs", { status, node, search, page }],
    queryFn: () => listJobs({ status, node, search, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    refetchInterval: settings.pollIntervalMs,
  });
  const allJobs = useQuery({
    queryKey: ["jobs", "all"],
    queryFn: () => listJobs({ limit: 999 }),
    refetchInterval: settings.pollIntervalMs,
  });

  const stats = useMemo(() => {
    const items = allJobs.data?.items ?? [];
    const count = (s: JobStatus) => items.filter((j) => j.status === s).length;
    return {
      running: count("RUNNING"),
      pending: count("PENDING"),
      failed: count("FAILED"),
      online: (nodesQuery.data ?? []).filter((n) => n.status === "ONLINE").length,
      nodes: (nodesQuery.data ?? []).length,
    };
  }, [allJobs.data, nodesQuery.data]);

  const total = jobsQuery.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Shell
      title="Jobs"
      subtitle="cluster workload overview"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => jobsQuery.refetch()}>
            <RefreshCw className={jobsQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link to="/jobs/new">
              <Plus className="size-4" /> New job
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Running" value={stats.running} tone="info" hint="active workloads" />
        <MetricCard label="Queued" value={stats.pending} hint="waiting for a node" />
        <MetricCard label="Failed" value={stats.failed} tone="danger" hint="need attention" />
        <MetricCard
          label="Nodes online"
          value={`${stats.online}/${stats.nodes}`}
          tone="success"
          hint="heartbeat within 90s"
        />
      </div>

      <div className="panel mt-6 overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-border p-3">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search by name or job ID"
              aria-label="Search jobs"
              className="pl-8"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as JobStatus | "ALL");
              setPage(0);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All statuses" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={node}
            onValueChange={(v) => {
              setNode(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filter by node">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All nodes</SelectItem>
              {(nodesQuery.data ?? []).map((n) => (
                <SelectItem key={n.node_id} value={n.node_id}>
                  {n.node_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {jobsQuery.isPending ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (jobsQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="No jobs match these filters"
            description="Try clearing the search or submit a new job to the cluster."
            action={
              <Button size="sm" asChild>
                <Link to="/jobs/new">Submit a job</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Job</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Node</th>
                  <th className="px-4 py-2.5 font-medium">Resources</th>
                  <th className="px-4 py-2.5 font-medium">Runtime</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {jobsQuery.data!.items.map((job) => (
                  <tr key={job.job_id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/jobs/$jobId"
                        params={{ jobId: job.job_id }}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {job.spec.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{job.job_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{job.node_id ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {job.spec.resources.gpus}
                      {(job.spec.resources.vram_gb ?? 0) > 0
                        ? `×${job.spec.resources.vram_gb}GB`
                        : ""}{" "}
                      GPU · {job.spec.resources.cpus} CPU · {job.spec.resources.memory_gb} GB
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {fmtDuration(job.started_at, job.completed_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fmtAgo(job.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span className="font-mono">
            {total === 0 ? "0" : page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of{" "}
            {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
