import Link from 'next/link';

import { submitAccessCode } from './actions';

function readSearchParam(value: string | string[] | undefined): string | undefined {
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
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const gateEnabled = Boolean(process.env.SITE_ACCESS_CODE);
  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeNext(readSearchParam(resolvedSearchParams?.next));
  const showError = readSearchParam(resolvedSearchParams?.error) === '1';

  return (
    <div className='min-h-[calc(100vh-48px)] flex items-center justify-center px-4 py-12'>
      <div className='w-full max-w-md border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-6 bg-white dark:bg-gray-900'>
        <h1 className='text-2xl font-semibold text-center'>Access required</h1>
        <p className='text-sm text-center text-gray-600 dark:text-gray-300 mt-2'>Enter the access code to continue.</p>

        {!gateEnabled ? (
          <div className='mt-6 text-sm text-gray-700 dark:text-gray-300'>
            <p className='mb-3'>The access gate is disabled (missing server env var `SITE_ACCESS_CODE`).</p>
            <Link className='text-blue-600 dark:text-blue-400 underline' href={nextPath}>
              Continue
            </Link>
          </div>
        ) : (
          <form action={submitAccessCode} className='mt-6 space-y-4'>
            <input type='hidden' name='next' value={nextPath} />

            <div>
              <label className='block text-sm font-medium mb-1' htmlFor='code'>
                Access code
              </label>
              <input
                id='code'
                name='code'
                type='password'
                required
                autoFocus
                className='w-full border border-gray-400 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-950'
                placeholder='Enter code'
              />
              {showError && <p className='text-red-600 text-xs mt-2'>Invalid code.</p>}
            </div>

            <div className='flex justify-end'>
              <button type='submit' className='bg-blue-600 text-white px-6 py-2 rounded font-semibold shadow hover:bg-blue-700 transition'>
                Continue
              </button>
            </div>
          </form>
        )}

        {/* <div className='mt-6 text-xs text-gray-500 dark:text-gray-400'>
          Tip: use a long, random code in production (Vercel env var `SITE_ACCESS_CODE`).
        </div> */}
      </div>
    </div>
  );
}
