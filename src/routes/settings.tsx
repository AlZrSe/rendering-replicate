import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isLocalhost, setSettings, useSettings } from "@/lib/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Scientific Home Cluster" },
      {
        name: "description",
        content:
          "Configure the cluster API base URL, bearer token, polling interval, reconnect delay and theme.",
      },
      { property: "og:title", content: "Settings · Scientific Home Cluster" },
      {
        property: "og:description",
        content: "Connection, streaming and appearance settings for the cluster dashboard.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, ready } = useSettings();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(settings);
  const [show, setShow] = useState(false);
  const local = isLocalhost();

  useEffect(() => {
    if (ready) setDraft(settings);
  }, [ready, settings]);

  const save = () => {
    setSettings({
      apiBaseUrl: draft.apiBaseUrl.trim(),
      token: draft.token.trim(),
      wsReconnectMs: Number(draft.wsReconnectMs),
      pollIntervalMs: Number(draft.pollIntervalMs),
    });
    toast.success("Settings saved");
  };

  const signOut = () => {
    setSettings({ token: "" });
    navigate({ to: "/login" });
  };

  return (
    <Shell title="Settings" subtitle="stored in this browser">
      <div className="grid max-w-2xl gap-4">
        <section className="panel space-y-4 p-4">
          <h2 className="text-sm font-semibold">Connection</h2>
          <div className="space-y-2">
            <Label htmlFor="api">API base URL</Label>
            <Input
              id="api"
              className="font-mono text-sm"
              value={draft.apiBaseUrl}
              onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Bearer token</Label>
            <div className="relative">
              <Input
                id="token"
                type={show ? "text" : "password"}
                className="pr-10 font-mono text-sm"
                value={draft.token}
                onChange={(e) => setDraft({ ...draft, token: e.target.value })}
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
            {local && (
              <p className="text-xs text-muted-foreground">
                Running on localhost — authorisation is skipped, so the token is optional here.
              </p>
            )}
          </div>
        </section>

        <section className="panel space-y-4 p-4">
          <h2 className="text-sm font-semibold">Live updates</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="poll">Poll interval (ms)</Label>
              <Input
                id="poll"
                type="number"
                min={1000}
                step={500}
                value={draft.pollIntervalMs}
                onChange={(e) => setDraft({ ...draft, pollIntervalMs: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reconnect">WebSocket reconnect delay (ms)</Label>
              <Input
                id="reconnect"
                type="number"
                min={500}
                step={500}
                value={draft.wsReconnectMs}
                onChange={(e) => setDraft({ ...draft, wsReconnectMs: Number(e.target.value) })}
              />
            </div>
          </div>
        </section>

        <section className="panel flex items-center justify-between p-4">
          <div>
            <h2 className="text-sm font-semibold">Dark mode</h2>
            <p className="text-xs text-muted-foreground">Applies immediately and is remembered.</p>
          </div>
          <Switch
            checked={settings.theme === "dark"}
            onCheckedChange={(v) => setSettings({ theme: v ? "dark" : "light" })}
            aria-label="Toggle dark mode"
          />
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save}>Save settings</Button>
          {!local && (
            <Button variant="outline" onClick={signOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          )}
        </div>
      </div>
    </Shell>
  );
}
