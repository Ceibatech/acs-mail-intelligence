import { Suspense } from "react";
import { LoadingState } from "@/components/data-state";
import { EmailSearchPage } from "@/components/emails/email-search-page";

export default function EmailsRoute() {
  return (
    <Suspense fallback={<LoadingState label="Ouverture de la recherche..." />}>
      <EmailSearchPage />
    </Suspense>
  );
}
