import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/Shell";
import { YamlBlock } from "@/components/YamlBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createJob } from "@/lib/api";
import { toYaml } from "@/lib/format";
import { useProfiles, type SoftwareProfile } from "@/lib/profiles";
import type { JobSpec } from "@/lib/types";

export const Route = createFileRoute("/jobs/new")({
  head: () => ({
    meta: [
      { title: "Submit job · Scientific Home Cluster" },
      {
        name: "description",
        content:
          "Describe a scientific compute job — command, resources, Syncthing paths and retry policy — and preview the generated job.yaml.",
      },
      { property: "og:title", content: "Submit job · Scientific Home Cluster" },
      {
        property: "og:description",
        content: "Build a cluster job spec with live YAML preview and validation.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { profile?: string } => {
    const p = search["profile"];
    return typeof p === "string" ? { profile: p } : {};
  },
  component: SubmitJobPage,
});

const schema = z.object({
  name: z
    .string()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9-_]+$/i, "Letters, numbers, dashes and underscores only"),
  command: z.string().min(3, "Command is required"),
  working_dir: z.string().optional(),
  gpus: z.coerce.number().int().min(0).max(8),
  vram_gb: z.coerce.number().int().min(0).max(1024),
  cpus: z.coerce.number().int().min(1).max(128),
  memory_gb: z.coerce.number().int().min(1).max(1024),
  input: z.string().optional(),
  output: z.string().optional(),
  max_retries: z.coerce.number().int().min(0).max(10),
  retry_delay_seconds: z.coerce.number().int().min(0).max(3600),
  env: z.array(z.object({ key: z.string(), value: z.string() })),
});

type FormValues = z.input<typeof schema>;

function SubmitJobPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("form");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      command: "python -u train.py --config configs/default.yaml",
      working_dir: "/sync/projects/new-run",
      gpus: 1,
      vram_gb: 12,
      cpus: 8,
      memory_gb: 16,
      input: "data/in",
      output: "data/out",
      max_retries: 3,
      retry_delay_seconds: 60,
      env: [{ key: "PYTHONUNBUFFERED", value: "1" }],
    },
    mode: "onBlur",
  });

  const envFields = useFieldArray({ control: form.control, name: "env" });
  const values = form.watch();

  const search = Route.useSearch();
  const { profiles, ready } = useProfiles();
  const [profileId, setProfileId] = useState(search.profile ?? "none");
  const applied = useRef(false);

  const applyProfile = (p: SoftwareProfile) => {
    form.reset({
      name: form.getValues("name"),
      command: p.command,
      working_dir: p.working_dir,
      gpus: p.gpus,
      vram_gb: p.vram_gb ?? 0,
      cpus: p.cpus,
      memory_gb: p.memory_gb,
      input: p.input,
      output: p.output,
      max_retries: p.max_retries,
      retry_delay_seconds: p.retry_delay_seconds,
      env: p.env.length ? p.env.map((e) => ({ ...e })) : [{ key: "", value: "" }],
    });
  };

  useEffect(() => {
    if (!ready || applied.current || !search.profile) return;
    const p = profiles.find((x) => x.id === search.profile);
    if (p) {
      applied.current = true;
      applyProfile(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profiles, search.profile]);

  const onProfileChange = (id: string) => {
    setProfileId(id);
    const p = profiles.find((x) => x.id === id);
    if (p) applyProfile(p);
  };

  const spec: JobSpec = useMemo(
    () => ({
      name: values.name || "unnamed-job",
      command: values.command,
      working_dir: values.working_dir,
      env: Object.fromEntries(
        (values.env ?? []).filter((e) => e.key.trim()).map((e) => [e.key.trim(), e.value]),
      ),
      resources: {
        gpus: Number(values.gpus),
        vram_gb: Number(values.vram_gb),
        cpus: Number(values.cpus),
        memory_gb: Number(values.memory_gb),
      },
      paths: { input: values.input, output: values.output },
      retry: {
        max_retries: Number(values.max_retries),
        retry_delay_seconds: Number(values.retry_delay_seconds),
      },
    }),
    [values],
  );

  const yaml = useMemo(() => toYaml(spec), [spec]);

  const mutation = useMutation({
    mutationFn: () => createJob(spec),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(`Job ${job.job_id} queued`);
      navigate({ to: "/jobs/$jobId", params: { jobId: job.job_id } });
    },
    onError: () => toast.error("Could not submit the job"),
  });

  const onSubmit = form.handleSubmit(() => mutation.mutate());

  const fieldError = (name: keyof FormValues) =>
    form.formState.errors[name]?.message as string | undefined;

  return (
    <Shell
      title="Submit job"
      subtitle="POST /jobs"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" /> Back to jobs
          </Link>
        </Button>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="yaml">YAML preview</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="mt-4 space-y-5">
            <div className="panel space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="profile">Software profile</Label>
                <Link to="/profiles" className="text-xs text-primary hover:underline">
                  Manage profiles
                </Link>
              </div>
              <Select value={profileId} onValueChange={onProfileChange}>
                <SelectTrigger id="profile" aria-label="Software profile">
                  <SelectValue placeholder="Start from scratch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Start from scratch</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Picking a profile fills in the command, resources, paths, environment and retry
                policy for codes like VASP, LAMMPS or RMCProfile.
              </p>
            </div>

            <div className="panel space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="name">Job name *</Label>
                <Input id="name" {...form.register("name")} placeholder="protein-fold-batch" />
                {fieldError("name") && (
                  <p className="text-xs text-destructive">{fieldError("name")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="command">Command *</Label>
                <Textarea id="command" rows={3} className="font-mono text-xs" {...form.register("command")} />
                {fieldError("command") && (
                  <p className="text-xs text-destructive">{fieldError("command")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="working_dir">Working directory</Label>
                <Input id="working_dir" className="font-mono text-xs" {...form.register("working_dir")} />
              </div>
            </div>

            <div className="panel space-y-4 p-4">
              <h3 className="text-sm font-semibold">Resources</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="gpus">GPUs</Label>
                  <Input id="gpus" type="number" min={0} {...form.register("gpus")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vram_gb">VRAM per GPU (GB)</Label>
                  <Input id="vram_gb" type="number" min={0} {...form.register("vram_gb")} />
                  {fieldError("vram_gb") && (
                    <p className="text-xs text-destructive">{fieldError("vram_gb")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpus">CPU cores</Label>
                  <Input id="cpus" type="number" min={1} {...form.register("cpus")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memory_gb">Memory (GB)</Label>
                  <Input id="memory_gb" type="number" min={1} {...form.register("memory_gb")} />
                </div>
              </div>
            </div>

            <div className="panel space-y-4 p-4">
              <h3 className="text-sm font-semibold">Syncthing paths</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="input">Input path</Label>
                  <Input id="input" className="font-mono text-xs" {...form.register("input")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="output">Output path</Label>
                  <Input id="output" className="font-mono text-xs" {...form.register("output")} />
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
                  onClick={() => envFields.append({ key: "", value: "" })}
                >
                  <Plus className="size-4" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {envFields.fields.map((field, i) => (
                  <div key={field.id} className="flex gap-2">
                    <Input
                      aria-label="Variable name"
                      placeholder="KEY"
                      className="font-mono text-xs"
                      {...form.register(`env.${i}.key`)}
                    />
                    <Input
                      aria-label="Variable value"
                      placeholder="value"
                      className="font-mono text-xs"
                      {...form.register(`env.${i}.value`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove variable"
                      onClick={() => envFields.remove(i)}
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
                  <Label htmlFor="max_retries">Max retries</Label>
                  <Input id="max_retries" type="number" min={0} {...form.register("max_retries")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retry_delay_seconds">Retry delay (s)</Label>
                  <Input
                    id="retry_delay_seconds"
                    type="number"
                    min={0}
                    {...form.register("retry_delay_seconds")}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="yaml" className="mt-4">
            <YamlBlock yaml={yaml} />
          </TabsContent>
        </Tabs>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="hidden lg:block">
            <YamlBlock yaml={yaml} />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting…" : "Submit job"}
          </Button>
          <p className="text-xs text-muted-foreground">
            The spec is sent as multipart <span className="font-mono">job.yaml</span> to{" "}
            <span className="font-mono">POST /jobs</span>.
          </p>
        </div>
      </form>
    </Shell>
  );
}
