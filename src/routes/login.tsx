import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Cpu, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, ServiceError } from "@/services";
import { getSettings, setSettings, defaultSettings } from "@/lib/settings";

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
  const [sharedToken, setSharedToken] = useState("");
  const [apiUrl, setApiUrl] = useState(defaultSettings.apiBaseUrl);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setApiUrl(s.apiBaseUrl);
    // On bypass hosts, the login form should render so the user can
    // explicitly choose to use the bypass token.
    if (typeof window !== "undefined" && window.localStorage.getItem("shc.loggedOut") === "true") {
      // If explicitly logged out, show login form even on localhost
      return;
    }
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(sharedToken);
      // Clear the loggedOut flag so Shell doesn't redirect away from login
      // after a successful login on localhost.
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("shc.loggedOut");
      }
      toast.success("Connected to cluster");
      navigate({ to: "/" });
    } catch (error) {
      // login throws when the backend cannot be reached or token is invalid.
      if (error instanceof ServiceError && error.error_code === "BACKEND_UNREACHABLE") {
        toast.error("Cannot reach the cluster backend", {
          description: `Nothing answered at ${apiUrl.trim() || "the configured API URL"}.`,
        });
      } else if (error instanceof ServiceError && error.error_code === "AUTH_SHARED_TOKEN_INVALID") {
        toast.error("Invalid shared token", {
          description: "The provided shared token is invalid. Please check your credentials and try again.",
        });
      } else if (error instanceof ServiceError && error.error_code === "AUTH_SHARED_TOKEN_NOT_CONFIGURED") {
        toast.error("Shared token not configured on server", {
          description: "The server administrator needs to set the SHARED_TOKEN environment variable.",
        });
      } else {
        toast.error("Could not log in", {
          description: "Check the API base URL and try again.",
        });
      }
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
            <p className="text-sm text-muted-foreground">
              Enter your bearer token to access the dashboard
            </p>
          </div>
        </div>
        <div className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sharedToken">Shared Token</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="sharedToken"
                type={show ? "text" : "password"}
                value={sharedToken}
                onChange={(e) => setSharedToken(e.target.value)}
                placeholder="Paste your cluster shared token here"
                className="pl-10 pr-10"
                disabled={busy}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShow((s) => !s)}
                disabled={busy}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiUrl">API Base URL</Label>
            <Input
              id="apiUrl"
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://your-backend.example.com/api/v1"
              disabled={busy}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Connecting…" : "Connect"}
          </Button>
        </div>
      </form>
    </div>
  );
}
