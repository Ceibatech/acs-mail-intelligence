import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div
        className={cn(
          "max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-lg border bg-card shadow-xl",
          size === "sm" && "max-w-md",
          size === "md" && "max-w-xl",
          size === "lg" && "max-w-2xl",
        )}
      >
        <div className="border-b p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <Button onClick={onClose} size="sm" type="button" variant="ghost">
              Fermer
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer ? <div className="border-t bg-muted/35 p-4">{footer}</div> : null}
      </div>
    </div>
  );
}
