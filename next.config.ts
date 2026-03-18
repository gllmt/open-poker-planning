import type { NextConfig } from "next";

const umamiHost = "https://umami.pierreguillemot.dev";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
const supabaseWsOrigin = supabaseOrigin
  ? supabaseOrigin.replace(/^http/, "ws")
  : null;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexOrigin = convexUrl ? new URL(convexUrl).origin : null;
const convexWsOrigin = convexOrigin
  ? convexOrigin.replace(/^http/, "ws")
  : null;
const posthogUrl = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const posthogOrigin = posthogUrl ? new URL(posthogUrl).origin : null;

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline' ${umamiHost}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com",
  "font-src 'self'",
  [
    "connect-src 'self'",
    umamiHost,
    supabaseOrigin,
    supabaseWsOrigin,
    "https://*.supabase.co",
    "wss://*.supabase.co",
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

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.10","192.168.1.20", "10.0.5.109", "10.0.5.88"],
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
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
