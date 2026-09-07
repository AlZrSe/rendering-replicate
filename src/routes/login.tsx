import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Cpu, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateToken } from "@/lib/api";
import { getSettings, setSettings } from "@/lib/settings";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · Scientific Home Cluster" },
      {
        name: "description",
        content: "Enter your cluster bearer token to monitor jobs, nodes and GPU metrics.",
      },
      { property: "og:title", content: "Sign in · Scientific Home Cluster" },
      {
        property: "og:description",
        content: "Enter your cluster bearer token to access the compute dashboard.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [apiUrl, setApiUrl] = useState("http://localhost:8000/api/v1");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setApiUrl(s.apiBaseUrl);
    if (s.token) navigate({ to: "/" });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await validateToken(token);
      if (!ok) {
        toast.error("That token looks too short (min 8 characters).");
        return;
      }
      setSettings({ token: token.trim(), apiBaseUrl: apiUrl.trim() });
      toast.success("Connected to cluster");
      navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid-backdrop flex min-h-screen items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="panel w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Cpu className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Scientific Home Cluster</h2>
            <p className="font-mono text-xs text-muted-foreground">bearer token required</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Bearer token</Label>
            <div className="relative">
              <KeyRound className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                id="token"
                type={show ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="cluster-token-…"
                autoComplete="off"
                required
                className="px-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide token" : "Show token"}
                className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api">API base URL</Label>
            <Input
              id="api"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Validating…" : "Connect"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            The backend isn't live yet, so this dashboard runs on realistic mock data. Any token of 8+
            characters works.
          </p>
        </div>
      </form>
    </div>
  );
}
