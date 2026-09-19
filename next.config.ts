import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Em Next.js 16 o lint roda separadamente. Erros de TypeScript continuam
// bloqueando o build para evitar publicar uma versão inconsistente.
const nextConfig: NextConfig = {};

const canUploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !canUploadSourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
  routeManifestInjection: false,
  suppressOnRouterTransitionStartWarning: true,
  widenClientFileUpload: false,
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
      removeTracing: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
      excludeReplayCompressionWorker: true,
    },
  },
});
