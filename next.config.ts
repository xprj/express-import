import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix workspace root detection
  turbopack: {
    root: __dirname,
  },
  // Allow larger file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
