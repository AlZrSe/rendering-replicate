import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
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
import { listJobs, listNodes } from "@/services";
import { fmtAgo, fmtDuration } from "@/lib/format";
import {
  dashboardCounters,
  jobsErrorCopy,
  listPanelState,
  nodeFilterOptions,
  nodesOnlineValue,
  paginationLabel,
} from "@/lib/jobs-dashboard";
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

  // Every "what do I draw" decision on this page lives in `@/lib/jobs-dashboard` as a
  // pure function (issue #42). This block is the wiring; the decisions themselves are
  // unit-tested in `src/lib/jobs-dashboard.test.ts`, which is the only way to check
  // them here — there is no component-test renderer in this repository.
  //
  // `listPanelState` is what orders `isError` ahead of the zero test. Inlined, the
  // `(data?.items.length ?? 0) === 0` form read `true` for a failed query and this
  // page reported a cluster it had never reached as empty, with four zeroed cards.
  const panelState = listPanelState(jobsQuery);
  const counters = useMemo(
    () =>
      dashboardCounters(
        { isError: allJobs.isError, data: allJobs.data?.items },
        { isError: nodesQuery.isError, data: nodesQuery.data },
      ),
    [allJobs.isError, allJobs.data, nodesQuery.isError, nodesQuery.data],
  );
  const nodeOptions = nodeFilterOptions({
    isError: nodesQuery.isError,
    data: nodesQuery.data,
  });
  const errorCopy = jobsErrorCopy(jobsQuery.error);

  const total = jobsQuery.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const refreshing = jobsQuery.isFetching || allJobs.isFetching || nodesQuery.isFetching;

  // AC-4: one click must repair everything this page shows. It used to refetch only
  // `jobsQuery`, so the table recovered while the stat cards and the node filter kept
  // their old — or zeroed — values until the next poll tick, leaving the page
  // describing three different moments at once. The Retry button in the error branch
  // reuses this rather than adding a second, narrower path.
  const refreshAll = () => {
    void jobsQuery.refetch();
    void allJobs.refetch();
    void nodesQuery.refetch();
  };

  return (
    <Shell
      title="Jobs"
      subtitle="cluster workload overview"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
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
        <MetricCard label="Running" value={counters.running} tone="info" hint="active workloads" />
        <MetricCard label="Queued" value={counters.pending} hint="waiting for a node" />
        <MetricCard label="Failed" value={counters.failed} tone="danger" hint="need attention" />
        <MetricCard
          label="Nodes online"
          value={nodesOnlineValue(counters.online, counters.nodes)}
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
              {nodeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {panelState === "pending" ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : panelState === "error" ? (
          // AC-5: this branch is a render output, not a side effect. `/nodes` and
          // `/jobs/$jobId` both invoke the error-notification hook from their component
          // bodies and therefore re-notify on every render; that is the pattern this
          // route must not copy. This route raises no notification at all, deliberately:
          // `jobsQuery` and `allJobs` poll every 7s, so one would repeat for as long as
          // the backend is down, and the de-duplicating helper that could prevent that is
          // out of scope for this issue. The Retry button below is the recovery affordance.
          <div className="space-y-4 p-8 text-center">
            <AlertCircle className="mx-auto size-12 text-destructive" />
            <h3 className="text-lg font-semibold">{errorCopy.title}</h3>
            <p className="text-sm text-muted-foreground">{errorCopy.description}</p>
            <Button variant="outline" onClick={refreshAll}>
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} /> Retry
            </Button>
          </div>
        ) : panelState === "empty" ? (
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
                  <tr
                    key={job.job_id}
                    className="border-b border-border/60 last:border-0 hover:bg-accent/40"
                  >
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
            {paginationLabel({ page, pageSize: PAGE_SIZE, total, failed: jobsQuery.isError })}
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
