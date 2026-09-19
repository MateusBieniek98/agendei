import "server-only";

type LogLevel = "info" | "warn" | "error";
type LogValue = string | number | boolean | null | undefined | Error;
type LogContext = Record<string, LogValue>;

const SENSITIVE_KEY = /(token|password|senha|secret|authorization|cookie|service.role)/i;

function safeContext(context: LogContext) {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (SENSITIVE_KEY.test(key)) return [key, "[REDACTED]"];
      if (value instanceof Error) {
        return [key, { name: value.name, message: value.message }];
      }
      if (typeof value === "string" && value.length > 500) {
        return [key, `${value.slice(0, 500)}…`];
      }
      return [key, value ?? null];
    }),
  );
}

export function logEvent(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    ...safeContext(context),
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}
