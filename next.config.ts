import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "isomorphic-git", "memfs", "jszip", "node-diff3"],
};

export default nextConfig;
