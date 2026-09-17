import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, MemoryStick, Server } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { NodeStatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listNodes } from "@/services";
import { fmtAgo } from "@/lib/format";
import { useSettings } from "@/lib/settings";

export const Route = createFileRoute("/nodes/")({
  head: () => ({
    meta: [
      { title: "Nodes · Scientific Home Cluster" },
      {
        name: "description",
        content:
          "Cluster health at a glance: node status, GPU models, CPU cores, memory and heartbeat freshness.",
      },
      { property: "og:title", content: "Nodes · Scientific Home Cluster" },
      {
        property: "og:description",
        content: "Monitor every machine in your scientific home cluster.",
      },
    ],
  }),
  component: NodesPage,
});

function NodesPage() {
  const { settings } = useSettings();
  const [filter, setFilter] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");
  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: listNodes,
    refetchInterval: settings.pollIntervalMs,
  });

  const nodes = (nodesQuery.data ?? []).filter((n) => filter === "ALL" || n.status === filter);

  return (
    <Shell
      title="Nodes"
      subtitle="GET /nodes"
      actions={
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-36" aria-label="Filter nodes by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All nodes</SelectItem>
            <SelectItem value="ONLINE">Online</SelectItem>
            <SelectItem value="OFFLINE">Offline</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {nodesQuery.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<Server className="size-6" />}
            title="No nodes to show"
            description="Nodes appear here after they register with POST /nodes/register."
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {nodes.map((node) => (
            <Link
              key={node.node_id}
              to="/nodes/$nodeId"
              params={{ nodeId: node.node_id }}
              className="panel block p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{node.node_id}</p>
                  <p className="font-mono text-xs text-muted-foreground">{node.hostname}</p>
                </div>
                <NodeStatusBadge status={node.status} lastHeartbeat={node.last_heartbeat} />
              </div>
              <dl className="mt-4 space-y-2 text-xs">
                <Row icon={<HardDrive className="size-3.5" />} label="GPU">
                  {node.gpus.length
                    ? node.gpus.map((g) => `${g.name} (${g.memory_gb} GB)`).join(", ")
                    : "none"}
                </Row>
                <Row icon={<Cpu className="size-3.5" />} label="CPU">
                  {node.cpus} cores · {node.os}
                </Row>
                <Row icon={<MemoryStick className="size-3.5" />} label="RAM">
                  {node.memory_gb} GB
                </Row>
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>heartbeat {fmtAgo(node.last_heartbeat)}</span>
                <span className="font-mono">{node.current_job_id ?? "idle"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="w-9 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 font-mono break-words">{children}</span>
    </div>
  );
}
