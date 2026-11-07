import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import { SyncthingDashboard } from "@/components/SyncthingDashboard";

export const Route = createFileRoute("/syncthing")({
  head: () => ({
    meta: [
      { title: "Syncthing · Scientific Home Cluster" },
      {
        name: "description",
        content: "Syncthing sync status and embedded web GUI.",
      },
      { property: "og:title", content: "Syncthing · Scientific Home Cluster" },
    ],
  }),
  component: SyncthingPage,
});

function SyncthingPage() {
  return (
    <Shell title="Syncthing" subtitle="sync status and GUI">
      <SyncthingDashboard />
    </Shell>
  );
}
