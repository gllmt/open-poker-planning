import type { Metadata } from 'next';
import Link from 'next/link';
import { submitAccessCode } from './actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { i18n, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { sanitizeInternalPath } from '@/lib/security/safe-redirect';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function readSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : i18n.defaultLocale;
  const dictionary = await getDictionary(locale);
  const gateEnabled = Boolean(process.env.SITE_ACCESS_CODE);
  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeInternalPath(
    readSearchParam(resolvedSearchParams?.next),
    `/${locale}`
  );
  const showError = readSearchParam(resolvedSearchParams?.error) === '1';

  return (
    <div className="flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle>{dictionary.access.title}</CardTitle>
          <CardDescription>{dictionary.access.description}</CardDescription>
        </CardHeader>

        <CardContent>
          {!gateEnabled ? (
            <div className="text-muted-foreground text-sm">
              <p className="mb-3">{dictionary.access.disabled}</p>
              <Link
                className="text-primary underline underline-offset-4"
                href={nextPath}
              >
                {dictionary.common.continue}
              </Link>
            </div>
          ) : (
            <form
              action={submitAccessCode}
              className="space-y-4"
              suppressHydrationWarning
            >
              <input type="hidden" name="next" value={nextPath} />

              <div className="flex flex-col gap-2">
                <Label htmlFor="code">{dictionary.access.accessCode}</Label>
                <Input
                  id="code"
                  name="code"
                  type="password"
                  required
                  suppressHydrationWarning
                  placeholder={dictionary.access.codePlaceholder}
                  aria-invalid={showError || undefined}
                />
                {showError && (
                  <p className="text-destructive text-xs">
                    {dictionary.access.invalidCode}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit">{dictionary.common.continue}</Button>
              </div>
            </form>
          )}
        </CardContent>

        {/* <div className='mt-6 text-xs text-gray-500 dark:text-gray-400'>
          Tip: use a long, random code in production (Vercel env var `SITE_ACCESS_CODE`).
        </div> */}
      </Card>
    </div>
  );
}
