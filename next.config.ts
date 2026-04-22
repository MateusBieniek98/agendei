import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint é rodado separadamente no CI; não bloqueia o build de produção
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TypeScript já é verificado com tsc --noEmit; não bloqueia o build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
