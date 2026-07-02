import { Badge, type BadgeProps } from "@/components/ui/badge";

const statusMap: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  success: { label: "Succès", variant: "success" },
  failed: { label: "Échec", variant: "destructive" },
  running: { label: "En cours", variant: "warning" },
  open: { label: "Ouverte", variant: "warning" },
  in_progress: { label: "En cours", variant: "secondary" },
  closed: { label: "Clôturée", variant: "success" },
  urgent: { label: "Urgente", variant: "destructive" },
  high: { label: "Haute", variant: "warning" },
  medium: { label: "Moyenne", variant: "secondary" },
  low: { label: "Basse", variant: "outline" },
};

export function StatusBadge({ value }: { value?: string | null }) {
  const config = value ? statusMap[value] : null;

  return (
    <Badge variant={config?.variant || "outline"}>
      {config?.label || value || "Non renseigné"}
    </Badge>
  );
}
