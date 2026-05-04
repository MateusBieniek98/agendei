import type { NextConfig } from "next";

// Configuração mínima. Em Next.js 16 a opção `eslint` foi removida
// daqui — lint agora roda separadamente via `npm run lint`.
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
} as NextConfig;

export default nextConfig;
