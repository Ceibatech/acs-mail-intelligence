import { EmailDetailPage } from "@/components/emails/email-detail-page";

export default async function EmailDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmailDetailPage id={id} />;
}
