import { trace } from "@opentelemetry/api";
import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/observability/sentry-options";
import {
  attachOpenTelemetryTrace,
  sanitizeSentryEvent,
} from "@/lib/observability/sentry-privacy";

Sentry.init({
  ...baseSentryOptions(
    process.env.NEXT_PUBLIC_SENTRY_DSN,
    process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV
  ),
  skipOpenTelemetrySetup: true,
  beforeSend(event) {
    const traceId = trace.getActiveSpan()?.spanContext().traceId;
    return sanitizeSentryEvent(attachOpenTelemetryTrace(event, traceId));
  },
});
