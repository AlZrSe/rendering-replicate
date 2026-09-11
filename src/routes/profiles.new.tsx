import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { ProfileForm } from "@/components/ProfileForm";
import { Button } from "@/components/ui/button";
import { blankProfile } from "@/lib/profiles";

export const Route = createFileRoute("/profiles/new")({
  head: () => ({
    meta: [
      { title: "New profile · Scientific Home Cluster" },
      {
        name: "description",
        content:
          "Create a reusable run profile: command, default resources, paths, environment variables and retry policy.",
      },
      { property: "og:title", content: "New profile · Scientific Home Cluster" },
      {
        property: "og:description",
        content: "Define a run profile for your scientific software.",
      },
    ],
  }),
  component: NewProfilePage,
});

function NewProfilePage() {
  return (
    <Shell
      title="New profile"
      subtitle="software run template"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/profiles">
            <ArrowLeft className="size-4" /> All profiles
          </Link>
        </Button>
      }
    >
      <ProfileForm initial={blankProfile()} mode="create" />
    </Shell>
  );
}
