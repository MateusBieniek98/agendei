import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  type SentryBreadcrumbLike,
  type SentryEventLike,
} from "@/lib/observability/sentry-privacy";

export function baseSentryOptions(dsn: string | undefined, environment: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: environment || "unknown",
    sampleRate: 1,
    sendDefaultPii: false,
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    normalizeDepth: 3,
    beforeSend: <T extends SentryEventLike>(event: T) => sanitizeSentryEvent(event),
    beforeBreadcrumb: <T extends SentryBreadcrumbLike>(breadcrumb: T) =>
      sanitizeSentryBreadcrumb(breadcrumb),
  };
}
