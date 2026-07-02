"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  DatabaseZap,
  Gauge,
  MailSearch,
  Settings,
  TimerReset,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Direction", icon: Gauge },
  { href: "/emails", label: "Recherche emails", icon: MailSearch },
  { href: "/followups", label: "Relances", icon: TimerReset },
  { href: "/analytics", label: "Analyse courtier", icon: BarChart3 },
  { href: "/etl", label: "Suivi ETL", icon: DatabaseZap },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-68 shrink-0 bg-[var(--color-rail)] text-[var(--color-rail-foreground)] lg:block">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            ACS
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">ACS Mail Intelligence</p>
            <p className="truncate text-xs text-[var(--color-rail-muted)]">
              Direction & opérations
            </p>
          </div>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {navigation.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-[var(--color-rail-muted)] transition-colors hover:bg-white/[0.08] hover:text-white",
                active && "bg-white/[0.12] text-white shadow-sm",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-3 mt-4 rounded-lg border border-white/10 bg-white/[0.06] p-3">
        <p className="text-xs font-medium text-white">Espace confidentiel</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-rail-muted)]">
          Direction, opérations et supervision ETL.
        </p>
      </div>
    </aside>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto border-b bg-card px-3 py-2 lg:hidden">
      {navigation.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs text-muted-foreground",
              active && "bg-secondary text-secondary-foreground",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
