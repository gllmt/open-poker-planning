import type { NextConfig } from "next";

const umamiHost = (process.env.NEXT_PUBLIC_UMAMI_HOST ?? "").replace(/\/$/, "");
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isDevelopment = process.env.NODE_ENV === "development";
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexOrigin = convexUrl ? new URL(convexUrl).origin : null;
const convexWsOrigin = convexOrigin
  ? convexOrigin.replace(/^http/, "ws")
  : null;
const posthogUrl = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const posthogOrigin = posthogUrl ? new URL(posthogUrl).origin : null;

const scriptSrc = [
  "script-src",
  "'self'",
  "'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
  umamiHost,
]
  .filter(Boolean)
  .join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com",
  "font-src 'self'",
  [
    "connect-src 'self'",
    umamiHost,
    convexOrigin,
    convexWsOrigin,
    "https://*.convex.cloud",
    "wss://*.convex.cloud",
    posthogOrigin,
  ]
    .filter(Boolean)
    .join(" "),
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
];

const ogImageCacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=86400, stale-while-revalidate=604800",
  },
];

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/og-image-en.jpg",
        headers: ogImageCacheHeaders,
      },
      {
        source: "/og-image-fr.jpg",
        headers: ogImageCacheHeaders,
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
