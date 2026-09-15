import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { i18n } from '@/lib/i18n/config';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function GameRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/${i18n.defaultLocale}/game/${id}`);
}
