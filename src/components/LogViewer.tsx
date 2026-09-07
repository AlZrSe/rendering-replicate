import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function lineTone(line: string) {
  if (/\bERROR|Traceback|CUDA out of memory\b/i.test(line)) return "text-destructive";
  if (/\bWARN/i.test(line)) return "text-warning";
  if (/\bDEBUG/i.test(line)) return "text-muted-foreground";
  return "text-foreground/90";
}

export function LogViewer({
  lines,
  connection,
  jobId,
}: {
  lines: string[];
  connection: "connecting" | "open" | "closed";
  jobId: string;
}) {
  const [follow, setFollow] = useState(true);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => (query ? lines.filter((l) => l.toLowerCase().includes(query.toLowerCase())) : lines),
    [lines, query],
  );

  useEffect(() => {
    if (follow && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [filtered, follow]);

  const download = () => {
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${jobId}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const connLabel = { connecting: "connecting", open: "streaming", closed: "disconnected" }[
    connection
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter log lines"
            aria-label="Filter log lines"
            className="pl-8 font-mono text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="follow" checked={follow} onCheckedChange={setFollow} />
          <Label htmlFor="follow" className="text-xs text-muted-foreground">
            Follow
          </Label>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]",
            connection === "open"
              ? "border-success/30 bg-success/10 text-success"
              : connection === "connecting"
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-border bg-muted text-muted-foreground",
          )}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {connLabel}
        </span>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-4" /> Download
        </Button>
      </div>
      <div
        ref={boxRef}
        role="log"
        aria-live="polite"
        className="max-h-[26rem] overflow-auto bg-secondary/40 p-3 font-mono text-xs leading-relaxed"
      >
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">No log lines match your filter.</p>
        ) : (
          filtered.map((line, i) => (
            <div key={i} className="flex gap-3 whitespace-pre-wrap">
              <span className="w-10 shrink-0 text-right text-muted-foreground/60 select-none">
                {i + 1}
              </span>
              <span className={lineTone(line)}>{line}</span>
            </div>
          ))
        )}
      </div>
      {!follow && (
        <button
          onClick={() => setFollow(true)}
          className="flex w-full items-center justify-center gap-2 border-t border-border p-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowDownToLine className="size-3.5" /> Jump to latest
        </button>
      )}
    </div>
  );
}
