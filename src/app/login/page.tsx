import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-10">
      <div className="w-full max-w-3xl space-y-6 text-center text-white">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-slate-400">ACS Mail Intelligence</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Connectez-vous pour piloter la donnée assurance
          </h1>
          <p className="mt-4 text-sm text-slate-300 sm:text-base">
            Espace sécurisé pour la direction, l’admin et l’analyse métier.
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
