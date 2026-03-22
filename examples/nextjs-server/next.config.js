/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,

  // Force Next.js to bundle TonConnect packages through its own webpack pipeline
  // so they share the same React instance instead of bundling their own copy.
  transpilePackages: ["@tonconnect/ui-react", "@tonconnect/ui", "@tonconnect/sdk"],

  // Compress all responses
  compress: true,

  // Allow images from UploadThing and Telegram CDN without blocking
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.ufs.sh" },
      { protocol: "https", hostname: "**.uploadthing.com" },
      { protocol: "https", hostname: "t.me" },
      { protocol: "https", hostname: "telegram.org" },
    ],
  },

  // Add caching headers to static API responses
  async headers() {
    return [
      {
        // Public creator list — cache 30s in browser, 60s on CDN edge
        source: "/api/creators",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=30" },
        ],
      },
      {
        // All other API routes — no cache (user-specific data)
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
