import type { Breadcrumb, Event } from "@sentry/nextjs";

export type SentryEventLike = Event;
export type SentryBreadcrumbLike = Breadcrumb;

type SentryHeaderMap = NonNullable<NonNullable<Event["request"]>["headers"]>;

const SENSITIVE_KEY = /(authorization|cookie|token|password|senha|secret|service.?role|api.?key)/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /bearer\s+[A-Z0-9._~+/=-]+/gi;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const CONNECTION_URL = /(?:postgres(?:ql)?|https?):\/\/[^\s"']+:[^\s"']+@[^\s"']+/gi;

export function redactSentryText(value: string) {
  return value
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(JWT, "[REDACTED_JWT]")
    .replace(CONNECTION_URL, "[REDACTED_CONNECTION]")
    .replace(EMAIL, "[REDACTED_EMAIL]")
    .slice(0, 2_000);
}

export function sanitizeSentryUrl(value: string) {
  try {
    const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
    const parsed = new URL(value, "https://local.invalid");
    return absolute ? `${parsed.origin}${parsed.pathname}` : parsed.pathname;
  } catch {
    return redactSentryText(value.split(/[?#]/, 1)[0] ?? "");
  }
}

function sanitizeHeaders(headers: SentryHeaderMap | undefined) {
  if (!headers) return undefined;
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, value]) => [key, typeof value === "string" ? redactSentryText(value) : value])
  );
}

export function sanitizeSentryBreadcrumb<T extends SentryBreadcrumbLike>(breadcrumb: T): T {
  const data = breadcrumb.data;
  if (breadcrumb.message) breadcrumb.message = redactSentryText(breadcrumb.message);
  if (data) {
    breadcrumb.data = Object.fromEntries(
      Object.entries(data).flatMap(([key, value]) => {
        if (SENSITIVE_KEY.test(key)) return [];
        if (key.toLowerCase() === "url" && typeof value === "string") {
          return [[key, sanitizeSentryUrl(value)]];
        }
        if (typeof value === "string") return [[key, redactSentryText(value)]];
        if (["method", "status_code", "type"].includes(key)) return [[key, value]];
        return [];
      })
    );
  }
  return breadcrumb;
}

export function sanitizeSentryEvent<T extends SentryEventLike>(event: T): T {
  if (event.message) event.message = redactSentryText(event.message);
  if (event.user) {
    const id = typeof event.user.id === "string" ? event.user.id : undefined;
    event.user = id ? { id } : undefined;
  }
  if (event.request) {
    if (event.request.url) event.request.url = sanitizeSentryUrl(event.request.url);
    event.request.query_string = undefined;
    event.request.cookies = undefined;
    if (event.request.data !== undefined) event.request.data = "[REDACTED]";
    event.request.headers = sanitizeHeaders(event.request.headers);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactSentryText(exception.value);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(sanitizeSentryBreadcrumb);
  }
  event.extra = undefined;
  return event;
}

export function attachOpenTelemetryTrace<T extends SentryEventLike>(
  event: T,
  traceId: string | undefined
) {
  if (traceId) {
    event.tags = { ...event.tags, "otel.trace_id": traceId };
  }
  return event;
}
