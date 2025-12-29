import Link from 'next/link';
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Access code</Label>
                <Input
                  id="code"
                  name="code"
                  type="password"
                  required
                  suppressHydrationWarning
                  placeholder="Enter code"
                  aria-invalid={showError || undefined}
                />
                {showError && (
                  <p className="text-destructive text-xs">Invalid code.</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit">Continue</Button>
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
