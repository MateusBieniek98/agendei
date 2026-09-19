import type { Instrumentation } from "next";
import { registerOTel } from "@vercel/otel";
import { logEvent } from "@/lib/logger";

export async function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "gn-silvicultura-web",
  });

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(error, request, context);
  }

  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;

  logEvent("error", "next.request.unhandled", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    digest,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
};
