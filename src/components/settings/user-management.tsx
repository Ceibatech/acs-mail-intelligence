"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type UserRow = {
  id: number;
  email: string;
  role: string;
  created_at: string;
};

const roles = ["admin", "manager", "analyst", "viewer"];

export function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/users", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de charger les comptes.");
      setUsers(payload.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de créer l'utilisateur.");
      setSuccess("Compte créé avec succès.");
      setEmail("");
      setPassword("");
      setRole("viewer");
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200/80 bg-white/95 shadow-sm">
        <CardHeader>
          <CardTitle>Gestion des comptes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div> : null}
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreate}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Mot de passe</label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Rôle</label>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3">
              <Button type="submit" className="w-full">
                Créer un compte
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="border border-slate-200/80 bg-white/95 shadow-sm">
        <CardHeader>
          <CardTitle>Comptes existants</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
