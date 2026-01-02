import { redirect } from 'next/navigation';

import { i18n } from '@/lib/i18n/config';

export default async function GameRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/${i18n.defaultLocale}/game/${id}`);
}
