import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "isomorphic-git", "memfs", "jszip", "node-diff3"],
  async redirects() {
    return [
      {
        source: "/programs",
        destination: "/home",
        permanent: false,
      },
      {
        source: "/programs/:path*",
        destination: "/home",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
