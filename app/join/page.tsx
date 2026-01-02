import { redirect } from 'next/navigation';

import { i18n } from '@/lib/i18n/config';

export default function JoinRedirectPage() {
  redirect(`/${i18n.defaultLocale}/join`);
}
