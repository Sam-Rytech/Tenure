import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Hardhat project sits one level up and has its own lockfile, so Turbopack would otherwise
  // infer the repository root and warn on every build.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
