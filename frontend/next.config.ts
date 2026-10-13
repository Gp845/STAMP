import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The browser reaches the gateway through /gw, so only the frontend needs a public URL.
  async rewrites() {
    const gateway = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000";
    return [
      { source: "/gw/generate", destination: `${gateway}/generate` },
      { source: "/gw/stamps", destination: `${gateway}/stamps` },
      { source: "/gw/stamps/:file", destination: `${gateway}/stamps/:file` },
    ];
  },
  experimental: {
    proxyTimeout: 120000,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
