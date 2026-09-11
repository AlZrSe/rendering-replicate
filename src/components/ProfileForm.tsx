import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { YamlBlock } from "@/components/YamlBlock";
import { toYaml } from "@/lib/format";
import { deleteProfile, saveProfile, slugify, type SoftwareProfile } from "@/lib/profiles";

export function ProfileForm({ initial, mode }: { initial: SoftwareProfile; mode: "create" | "edit" }) {
  const navigate = useNavigate();
  const [p, setP] = useState<SoftwareProfile>(initial);
  const set = <K extends keyof SoftwareProfile>(key: K, value: SoftwareProfile[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v)));

  const yaml = toYaml({
    name: p.name || "unnamed-profile",
    software: p.software,
    command: p.command,
    working_dir: p.working_dir,
    env: Object.fromEntries(p.env.filter((e) => e.key.trim()).map((e) => [e.key.trim(), e.value])),
    resources: { gpus: p.gpus, cpus: p.cpus, memory_gb: p.memory_gb },
    paths: { input: p.input, output: p.output },
    retry: { max_retries: p.max_retries, retry_delay_seconds: p.retry_delay_seconds },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (p.name.trim().length < 3) {
      toast.error("Give the profile a name (3+ characters).");
      return;
    }
    if (p.command.trim().length < 3) {
      toast.error("A run command is required.");
      return;
    }
    saveProfile({ ...p, id: p.id || slugify(p.name), name: p.name.trim() });
    toast.success(mode === "create" ? "Profile created" : "Profile saved");
    navigate({ to: "/profiles" });
  };

  const remove = () => {
    deleteProfile(p.id);
    toast.success("Profile removed");
    navigate({ to: "/profiles" });
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      <div className="space-y-5">
        <div className="panel space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pname">Profile name *</Label>
              <Input
                id="pname"
                value={p.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="VASP — standard relaxation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="software">Software</Label>
              <Input
                id="software"
                value={p.software}
                onChange={(e) => set("software", e.target.value)}
                placeholder="VASP"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={2}
              value={p.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What this profile is for and which input files it expects."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd">Run command *</Label>
            <Textarea
              id="cmd"
              rows={3}
              className="font-mono text-xs"
              value={p.command}
              onChange={(e) => set("command", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wd">Working directory</Label>
            <Input
              id="wd"
              className="font-mono text-xs"
              value={p.working_dir}
              onChange={(e) => set("working_dir", e.target.value)}
            />
          </div>
        </div>

        <div className="panel space-y-4 p-4">
          <h3 className="text-sm font-semibold">Default resources</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="gpus">GPUs</Label>
              <Input
                id="gpus"
                type="number"
                min={0}
                value={p.gpus}
                onChange={(e) => set("gpus", num(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpus">CPU cores</Label>
              <Input
                id="cpus"
                type="number"
                min={1}
                value={p.cpus}
                onChange={(e) => set("cpus", num(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mem">Memory (GB)</Label>
              <Input
                id="mem"
                type="number"
                min={1}
                value={p.memory_gb}
                onChange={(e) => set("memory_gb", num(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="panel space-y-4 p-4">
          <h3 className="text-sm font-semibold">Syncthing paths</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="in">Input path</Label>
              <Input
                id="in"
                className="font-mono text-xs"
                value={p.input}
                onChange={(e) => set("input", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="out">Output path</Label>
              <Input
                id="out"
                className="font-mono text-xs"
                value={p.output}
                onChange={(e) => set("output", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="panel space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Environment variables</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set("env", [...p.env, { key: "", value: "" }])}
            >
              <Plus className="size-4" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {p.env.length === 0 && (
              <p className="text-xs text-muted-foreground">No variables yet.</p>
            )}
            {p.env.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label="Variable name"
                  placeholder="KEY"
                  className="font-mono text-xs"
                  value={row.key}
                  onChange={(e) =>
                    set(
                      "env",
                      p.env.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)),
                    )
                  }
                />
                <Input
                  aria-label="Variable value"
                  placeholder="value"
                  className="font-mono text-xs"
                  value={row.value}
                  onChange={(e) =>
                    set(
                      "env",
                      p.env.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove variable"
                  onClick={() => set("env", p.env.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel space-y-4 p-4">
          <h3 className="text-sm font-semibold">Retry policy</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mr">Max retries</Label>
              <Input
                id="mr"
                type="number"
                min={0}
                value={p.max_retries}
                onChange={(e) => set("max_retries", num(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rd">Retry delay (s)</Label>
              <Input
                id="rd"
                type="number"
                min={0}
                value={p.retry_delay_seconds}
                onChange={(e) => set("retry_delay_seconds", num(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <YamlBlock yaml={yaml} filename="profile.yaml" />
        <Button type="submit" className="w-full">
          {mode === "create" ? "Create profile" : "Save profile"}
        </Button>
        {mode === "edit" && (
          <Button type="button" variant="outline" className="w-full" onClick={remove}>
            <Trash2 className="size-4" /> Remove profile
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Profiles are stored in this browser and pre-fill the job submission form.
        </p>
      </div>
    </form>
  );
}
