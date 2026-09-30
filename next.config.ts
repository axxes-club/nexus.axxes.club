import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Don't advertise the framework on every response.
  poweredByHeader: false,
  reactStrictMode: true,
  // react-markdown + remark-gfm pull in a large plugin graph. Barrel-importing
  // them shipped modules the preview never touches.
  experimental: {
    optimizePackageImports: ["react-markdown", "remark-gfm"],
  },
  async headers() {
    return [
      {
        // The service worker itself must never be served from a stale copy, or a
        // released fix can take a full year to reach anyone already installed.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
