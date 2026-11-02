import { Settings } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";

export default function SettingsPage() {
  return (
    <EmptyState
      icon={Settings}
      title="Settings"
      description="Account settings, connected providers, and notification preferences will appear here."
    />
  );
}
