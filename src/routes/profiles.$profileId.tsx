import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { ProfileForm } from "@/components/ProfileForm";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { getProfile, type SoftwareProfile } from "@/lib/profiles";

export const Route = createFileRoute("/profiles/$profileId")({
  head: () => ({
    meta: [
      { title: "Edit profile · Scientific Home Cluster" },
      {
        name: "description",
        content:
          "Edit a software run profile: command, default resources, Syncthing paths, environment and retries.",
      },
      { property: "og:title", content: "Edit profile · Scientific Home Cluster" },
      {
        property: "og:description",
        content: "Adjust a saved run profile for your scientific software.",
      },
    ],
  }),
  component: EditProfilePage,
});

function EditProfilePage() {
  const { profileId } = Route.useParams();
  const [profile, setProfile] = useState<SoftwareProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(getProfile(profileId) ?? null);
    setReady(true);
  }, [profileId]);

  return (
    <Shell
      title={profile ? profile.name : "Edit profile"}
      subtitle={profileId}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/profiles">
            <ArrowLeft className="size-4" /> All profiles
          </Link>
        </Button>
      }
    >
      {!ready ? (
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      ) : profile ? (
        <ProfileForm initial={profile} mode="edit" />
      ) : (
        <EmptyState
          title="Profile not found"
          description="This profile no longer exists — it may have been removed."
        />
      )}
    </Shell>
  );
}
