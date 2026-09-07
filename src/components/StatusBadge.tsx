import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

const jobStyles: Record<JobStatus, string> = {
  PENDING: "bg-muted text-muted-foreground border-border",
  RUNNING: "bg-info/15 text-info border-info/30",
  COMPLETED: "bg-success/15 text-success border-success/30",
  FAILED: "bg-destructive/15 text-destructive border-destructive/30",
  CANCELLED: "bg-warning/15 text-warning border-warning/30",
};

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <span
      aria-label={`Status: ${status}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase",
        jobStyles[status],
        className,
      )}
    >
      {status === "RUNNING" && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-info" />
        </span>
      )}
      {status}
    </span>
  );
}

export function NodeStatusBadge({
  status,
  lastHeartbeat,
}: {
  status: "ONLINE" | "OFFLINE";
  lastHeartbeat?: string;
}) {
  const stale =
    status === "ONLINE" &&
    lastHeartbeat !== undefined &&
    Date.now() - new Date(lastHeartbeat).getTime() > 25_000;
  const label = status === "OFFLINE" ? "OFFLINE" : stale ? "DEGRADED" : "ONLINE";
  const styles =
    status === "OFFLINE"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : stale
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-success/15 text-success border-success/30";
  return (
    <span
      aria-label={`Node status: ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide",
        styles,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
