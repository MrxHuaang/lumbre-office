import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hyvento/shared", "@hyvento/map"],
  reactStrictMode: true,
};

export default nextConfig;
