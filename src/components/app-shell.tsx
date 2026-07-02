"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppSidebar,
  MobileNavigation,
  canAccessPath,
} from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import type { CurrentUser } from "@/types/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          setUser(null);
          if (pathname !== "/login") {
            router.replace("/login");
          }
          return;
        }

        const payload = await response.json();
        setUser(payload.user);

        if (pathname === "/login") {
          router.replace("/dashboard");
          return;
        }

        if (!canAccessPath(payload.user, pathname)) {
          router.replace("/dashboard");
        }
      } catch {
        setUser(null);
        if (pathname !== "/login") {
          router.replace("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [pathname, router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.replace("/login");
  };

  const isLoginPage = pathname === "/login";

  if (!isLoginPage && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="rounded-md border border-slate-200/80 bg-white/95 p-8 shadow-xl">
          <p className="text-sm font-medium text-slate-700">
            Chargement de l'authentification...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        {!isLoginPage && <AppSidebar user={user} />}
        <div className="flex min-w-0 flex-1 flex-col">
          {!isLoginPage ? (
            <>
              <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card/95 px-4 shadow-sm backdrop-blur md:px-6">
                <div>
                  <p className="text-sm font-semibold tracking-normal">
                    ACS Mail Intelligence
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pilotage des archives email assurance
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {user ? (
                    <div className="hidden flex-col items-end text-right text-xs sm:flex">
                      <span className="font-medium">{user.fullName || user.email}</span>
                      <span className="text-muted-foreground">{user.role}</span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-md border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Déconnexion
                  </button>
                  <Badge variant="success">Serveur</Badge>
                  <Badge variant="outline">Données protégées</Badge>
                </div>
              </header>
              <MobileNavigation user={user} />
            </>
          ) : null}
          <main className={`flex-1 ${isLoginPage ? "px-4 py-10" : "p-4 md:p-6 xl:p-8"}`}>
            {children}
          </main>
          {!isLoginPage ? (
            <footer className="border-t bg-card/50 px-4 py-6 md:px-6 xl:px-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-row flex-wrap items-center justify-center gap-8">
                  <Image
                    src="/acs.jpg"
                    alt="ACS Assureurs Conseils Service"
                    width={200}
                    height={200}
                    className="h-14 w-40 object-cover"
                  />
                  <Image
                    src="/ceibac.jpg"
                    alt="Ceiba Analytics"
                    width={200}
                    height={200}
                    className="h-14 w-40 object-cover"
                  />
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  <p>
                    Développé par <span className="font-semibold">Ceibac Analytics</span>
                  </p>
                  <p>
                    Contactez-nous :{" "}
                    <a
                      href="mailto:support@ceiba-analytics.com"
                      className="text-primary hover:underline"
                    >
                      support@ceiba-analytics.com
                    </a>
                  </p>
                </div>
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}
