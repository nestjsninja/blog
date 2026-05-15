import type { NextConfig } from "next";
import path from "node:path";

const root = path.resolve(".");

const nextConfig: NextConfig = {
  trailingSlash: true,
  turbopack: {
    root,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
