import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Large multipart uploads (e.g. EPUB ingest). See `experimental.serverActions.bodySizeLimit` in Next.js docs. */
  experimental: {
    serverActions: {
      bodySizeLimit: "256mb",
    },
  },
  async redirects() {
    return [
      { source: "/books", destination: "/discover", permanent: true },
      { source: "/books/:id", destination: "/discover/:id", permanent: true },
    ];
  },
  /** Avoid 307/308 on webhook POSTs when the provider URL includes a trailing slash. */
  async rewrites() {
    return [
      { source: "/api/webhooks/clerk/", destination: "/api/webhooks/clerk" },
      { source: "/api/webhooks/stripe/", destination: "/api/webhooks/stripe" },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "v3.fal.media",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "v3b.fal.media",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "fal.media",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
