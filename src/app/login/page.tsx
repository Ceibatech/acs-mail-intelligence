import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-lg shadow-emerald-950/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">
            ACS Mail Intelligence
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Connexion sécurisée
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Accès interne aux archives email et indicateurs courtage.
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
