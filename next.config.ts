import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  i18n: undefined,
  experimental: {
    instrumentationHook: true,
  } as any,
};

export default nextConfig;
