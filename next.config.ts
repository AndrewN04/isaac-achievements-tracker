import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Typed routes are stable in Next 15.5
  typedRoutes: true,
  // Turbopack can be customized here if needed
  turbopack: {}
};

export default nextConfig;