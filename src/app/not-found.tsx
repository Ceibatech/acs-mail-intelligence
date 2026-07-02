import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function NotFound() {
  return (
    <div>
      <PageHeader
        description="La page demandée n'existe pas ou n'est plus disponible."
        title="Page introuvable"
      />
      <Link className="text-sm underline" href="/dashboard">
        Revenir au tableau de bord
      </Link>
    </div>
  );
}
