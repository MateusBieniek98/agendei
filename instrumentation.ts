import type { Instrumentation } from "next";
import { registerOTel } from "@vercel/otel";
import { logEvent } from "@/lib/logger";

export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "gn-silvicultura-web",
  });
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
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
