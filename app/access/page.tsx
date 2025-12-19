import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { submitAccessCode } from './actions';

function readSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sanitizeNext(raw: string | undefined): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const gateEnabled = Boolean(process.env.SITE_ACCESS_CODE);
  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeNext(readSearchParam(resolvedSearchParams?.next));
  const showError = readSearchParam(resolvedSearchParams?.error) === '1';

  return (
    <div className="flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Access required</CardTitle>
          <CardDescription>Enter the access code to continue.</CardDescription>
        </CardHeader>

        <CardContent>
          {!gateEnabled ? (
            <div className="text-muted-foreground text-sm">
              <p className="mb-3">
                The access gate is disabled (missing server env var
                `SITE_ACCESS_CODE`).
              </p>
              <Link
                className="text-primary underline underline-offset-4"
                href={nextPath}
              >
                Continue
              </Link>
            </div>
          ) : (
            <form
              action={submitAccessCode}
              className="space-y-4"
              suppressHydrationWarning
            >
              <input type="hidden" name="next" value={nextPath} />

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="code">
                  Access code
                </label>
                <input
                  id="code"
                  name="code"
                  type="password"
                  required
                  suppressHydrationWarning
                  className="bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-4xl border px-3 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px]"
                  placeholder="Enter code"
                />
                {showError && (
                  <p className="text-destructive text-xs">Invalid code.</p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 h-9 rounded-4xl px-4 text-sm font-medium shadow-sm transition focus-visible:ring-[3px]"
                >
                  Continue
                </button>
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
