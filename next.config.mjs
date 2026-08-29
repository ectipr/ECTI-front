/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

/**
 * The Strapi origin, so images and client-side fetches to the CMS survive the
 * CSP. NEXT_PUBLIC_API_URL is read at build time, which is when these headers
 * are baked in — a deploy pointed at a different CMS needs a rebuild anyway.
 */
const cmsOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").origin;
  } catch {
    return "";
  }
})();

/**
 * script-src keeps 'unsafe-inline' on purpose. Next.js inlines the bootstrap
 * and the flight data on every page, so removing it means moving to a
 * nonce-per-request, which has to be generated in middleware.ts and threaded
 * through — worth doing, but a change to how pages render rather than a header
 * edit, and a half-done version breaks the site silently in production.
 *
 * The directives that don't depend on that are the ones carrying most of the
 * weight here: frame-ancestors stops the site being framed, form-action stops a
 * planted form posting elsewhere, base-uri stops an injected <base> from
 * repointing every relative URL on the page.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://va.vercel-scripts.com`,
  // Tailwind and the Radix components both set styles inline.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${cmsOrigin ? ` ${cmsOrigin}` : ""}`,
  // next/font/google downloads the fonts at build time and serves them from
  // our own origin, so no font CDN belongs here.
  "font-src 'self' data:",
  `connect-src 'self'${cmsOrigin ? ` ${cmsOrigin}` : ""} https://va.vercel-scripts.com https://vitals.vercel-insights.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // frame-ancestors above covers modern browsers; this is the same rule for
  // anything that only understands the older header.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Only in production: sending this from a dev server pins localhost to HTTPS
  // in the browser for two years.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig
