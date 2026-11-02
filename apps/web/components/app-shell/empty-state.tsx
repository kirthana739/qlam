import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border/60 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
      </div>

      <Card className="rounded-xl border border-dashed border-border/80 bg-card/50">
        <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Icon className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
