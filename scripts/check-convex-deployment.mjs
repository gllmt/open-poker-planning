/** @param {Record<string, string | undefined>} env */
export function assertProductionConvexConfig(env) {
  if (env.VERCEL_ENV !== 'production') return;

  const match = /^prod:([a-z0-9-]+)\|.+$/.exec(env.CONVEX_DEPLOY_KEY ?? '');
  if (!match) {
    throw new Error(
      'Production requires a Convex production deploy key in CONVEX_DEPLOY_KEY.'
    );
  }

  const targetUrl = `https://${match[1]}.convex.cloud`;
  if (env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/$/, '') !== targetUrl) {
    throw new Error(
      'CONVEX_DEPLOY_KEY and NEXT_PUBLIC_CONVEX_URL must target the same production deployment.'
    );
  }

  if ((env.CONVEX_SERVICE_SECRET?.length ?? 0) < 32) {
    throw new Error(
      'Production requires CONVEX_SERVICE_SECRET with at least 32 characters.'
    );
  }
}

if (import.meta.main) {
  try {
    assertProductionConvexConfig(process.env);
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : 'Invalid deployment configuration.'
    );
    process.exitCode = 1;
  }
}
