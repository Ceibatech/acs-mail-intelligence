"use client";

import { useState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath = "/dashboard" }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Identifiants incorrects");
        setLoading(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Identifiants incorrects");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full rounded-md border border-white/10 bg-white text-slate-950 shadow-2xl shadow-black/30">
      <form onSubmit={handleSubmit}>
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl">Se connecter</CardTitle>
          <p className="text-sm text-muted-foreground">
            Utilisez votre compte ACS autorisé.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="email"
                className="pl-9"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@acs.ci"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoComplete="current-password"
                className="pl-9"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Connexion en cours..." : "Se connecter"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
