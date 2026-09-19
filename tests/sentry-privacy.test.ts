import { describe, expect, it } from "vitest";
import {
  attachOpenTelemetryTrace,
  redactSentryText,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeSentryUrl,
} from "@/lib/observability/sentry-privacy";
import { baseSentryOptions } from "@/lib/observability/sentry-options";

describe("Sentry privacy", () => {
  it("stays disabled without a DSN and does not configure a second trace pipeline", () => {
    const options = baseSentryOptions(undefined, "test");

    expect(options.enabled).toBe(false);
    expect(options.sendDefaultPii).toBe(false);
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
  });

  it("redacts credentials and direct identifiers", () => {
    const text =
      "email pessoa@example.com Bearer abc.def token eyJabc.def.ghi " +
      "postgresql://user:secret@db.example.com/postgres";

    expect(redactSentryText(text)).toBe(
      "email [REDACTED_EMAIL] Bearer [REDACTED] token [REDACTED_JWT] [REDACTED_CONNECTION]"
    );
  });

  it("keeps route identity while removing query strings and fragments", () => {
    expect(sanitizeSentryUrl("https://app.example.com/api/producao?token=abc#private")).toBe(
      "https://app.example.com/api/producao"
    );
    expect(sanitizeSentryUrl("/login?erro=perfil")).toBe("/login");
  });

  it("removes request payload, secrets, PII and unbounded extras", () => {
    const event = sanitizeSentryEvent({
      message: "Falha para pessoa@example.com",
      user: { id: "user-id", email: "pessoa@example.com", ip_address: "127.0.0.1" },
      request: {
        url: "https://app.example.com/api/producao?client_id=private",
        query_string: "client_id=private",
        cookies: { session: "private" },
        data: { quantidade: 10 },
        headers: {
          authorization: "Bearer private",
          cookie: "session=private",
          "x-request-id": "request-id",
        },
      },
      exception: { values: [{ value: "Erro de pessoa@example.com" }] },
      extra: { payload: "private" },
    });

    expect(event.message).toBe("Falha para [REDACTED_EMAIL]");
    expect(event.user).toEqual({ id: "user-id" });
    expect(event.request).toEqual({
      url: "https://app.example.com/api/producao",
      query_string: undefined,
      cookies: undefined,
      data: "[REDACTED]",
      headers: { "x-request-id": "request-id" },
    });
    expect(event.exception?.values?.[0]?.value).toBe("Erro de [REDACTED_EMAIL]");
    expect(event.extra).toBeUndefined();
  });

  it("limits breadcrumb data and correlates the active OpenTelemetry trace", () => {
    const breadcrumb = sanitizeSentryBreadcrumb({
      message: "POST pessoa@example.com",
      data: {
        url: "https://app.example.com/api/producao?token=abc",
        method: "POST",
        authorization: "Bearer private",
        payload: { quantidade: 10 },
      },
    });
    const event = attachOpenTelemetryTrace({ tags: { runtime: "node" } }, "trace-id");

    expect(breadcrumb).toEqual({
      message: "POST [REDACTED_EMAIL]",
      data: { url: "https://app.example.com/api/producao", method: "POST" },
    });
    expect(event.tags).toEqual({ runtime: "node", "otel.trace_id": "trace-id" });
  });
});
