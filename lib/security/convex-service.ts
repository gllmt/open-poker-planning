import 'server-only';

const MIN_SERVICE_SECRET_LENGTH = 32;
let hasWarnedAboutInvalidSecret = false;

export function getConvexServiceSecret(): string | null {
  const secret = process.env.CONVEX_SERVICE_SECRET;
  if (secret && secret.length >= MIN_SERVICE_SECRET_LENGTH) return secret;

  if (!hasWarnedAboutInvalidSecret) {
    console.error(
      `CONVEX_SERVICE_SECRET is missing or shorter than ${MIN_SERVICE_SECRET_LENGTH} characters. Configure the same value in .env.local and the current Convex deployment.`
    );
    hasWarnedAboutInvalidSecret = true;
  }
  return null;
}
