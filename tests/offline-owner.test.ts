import { describe, expect, it } from "vitest";
import {
  normalizeOfflineOwnerId,
  offlineOwnerMatchesSession,
  offlineOwnerValidationError,
} from "@/lib/offline-owner";

describe("offline queue ownership", () => {
  it("normalizes valid owners and rejects empty values", () => {
    expect(normalizeOfflineOwnerId(" user-1 ")).toBe("user-1");
    expect(normalizeOfflineOwnerId("  ")).toBeNull();
    expect(normalizeOfflineOwnerId(null)).toBeNull();
  });

  it("allows only the authenticated owner", () => {
    expect(offlineOwnerMatchesSession("user-1", "user-1")).toBe(true);
    expect(offlineOwnerMatchesSession("user-1", "user-2")).toBe(false);
    expect(offlineOwnerMatchesSession(null, "user-1")).toBe(false);
  });

  it("keeps backward-compatible requests without an offline owner", () => {
    expect(offlineOwnerValidationError(undefined, "user-1")).toBeNull();
    expect(offlineOwnerValidationError("user-1", "user-1")).toBeNull();
    expect(offlineOwnerValidationError("user-2", "user-1")).toBe(
      "Este lançamento offline pertence a outro usuário.",
    );
  });
});
