import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许把构建产物写到独立目录（NEXT_DIST_DIR=xxx next build），
  // 这样在线上重建时不会覆盖正在被 next start 使用的 .next。
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3"],
  i18n: undefined,
  experimental: {
    instrumentationHook: true,
  } as any,
};

export default nextConfig;
