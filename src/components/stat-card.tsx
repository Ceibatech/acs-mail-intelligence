import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: React.ReactNode;
  description?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon ? (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border",
              tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
              tone === "danger" && "border-red-200 bg-red-50 text-red-700",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="metric-number text-2xl font-semibold">{value}</div>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
