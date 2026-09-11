import { createFileRoute, Link } from "@tanstack/react-router";
import { Cpu, MemoryStick, Pencil, Plus, RotateCcw, Rocket } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { restoreBuiltins, useProfiles } from "@/lib/profiles";

export const Route = createFileRoute("/profiles/")({
  head: () => ({
    meta: [
      { title: "Software profiles · Scientific Home Cluster" },
      {
        name: "description",
        content:
          "Reusable run profiles for VASP, LAMMPS, RMCProfile, GROMACS, Quantum ESPRESSO, CP2K and PyTorch jobs.",
      },
      { property: "og:title", content: "Software profiles · Scientific Home Cluster" },
      {
        property: "og:description",
        content: "Create and edit run profiles for well-known scientific codes.",
      },
    ],
  }),
  component: ProfilesPage,
});

function ProfilesPage() {
  const { profiles, ready } = useProfiles();

  return (
    <Shell
      title="Software profiles"
      subtitle="reusable job templates"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={restoreBuiltins}>
            <RotateCcw className="size-4" /> Restore defaults
          </Button>
          <Button size="sm" asChild>
            <Link to="/profiles/new">
              <Plus className="size-4" /> New profile
            </Link>
          </Button>
        </>
      }
    >
      {!ready ? (
        <p className="text-sm text-muted-foreground">Loading profiles…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((p) => (
            <div key={p.id} className="panel flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{p.name}</h2>
                  <p className="font-mono text-[11px] text-muted-foreground">{p.software || "custom"}</p>
                </div>
                <Badge variant={p.builtin ? "secondary" : "outline"}>
                  {p.builtin ? "built-in" : "custom"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{p.description || "No description."}</p>
              <pre className="overflow-x-auto rounded-md bg-secondary/40 p-2 font-mono text-[11px]">
                {p.command}
              </pre>
              <div className="flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Rocket className="size-3.5" /> {p.gpus} GPU
                </span>
                <span className="flex items-center gap-1">
                  <Cpu className="size-3.5" /> {p.cpus} cores
                </span>
                <span className="flex items-center gap-1">
                  <MemoryStick className="size-3.5" /> {p.memory_gb} GB
                </span>
              </div>
              <div className="mt-auto flex gap-2 pt-1">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/profiles/$profileId" params={{ profileId: p.id }}>
                    <Pencil className="size-4" /> Edit
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/jobs/new" search={{ profile: p.id }}>
                    Use profile
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
