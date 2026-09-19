import { afterEach, describe, expect, it, vi } from "vitest";
import { logEvent } from "@/lib/logger";

describe("logEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts secrets and limits oversized strings", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logEvent("info", "security.test", {
      authorization: "Bearer sensitive-value",
      note: "a".repeat(600),
      error: new Error("controlled failure"),
    });

    expect(info).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(info.mock.calls[0][0]));

    expect(payload.event).toBe("security.test");
    expect(payload.authorization).toBe("[REDACTED]");
    expect(payload.note).toHaveLength(501);
    expect(payload.note.endsWith("…")).toBe(true);
    expect(payload.error).toEqual({
      name: "Error",
      message: "controlled failure",
    });
  });
});
