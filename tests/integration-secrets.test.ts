import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "@/lib/integration-secrets";

const previousKey = process.env.INTEGRATIONS_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
  else process.env.INTEGRATIONS_ENCRYPTION_KEY = previousKey;
});

describe("integration secrets", () => {
  it("cifra e autentica o token sem guardar texto puro", () => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const token = "fst_token-de-staging";
    const encrypted = encryptIntegrationSecret(token);

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain(token);
    expect(decryptIntegrationSecret(encrypted)).toBe(token);
  });

  it("rejeita chave de servidor ausente ou inválida", () => {
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    expect(() => encryptIntegrationSecret("token")).toThrow("não configurada");

    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.from("curta").toString("base64");
    expect(() => encryptIntegrationSecret("token")).toThrow("32 bytes");
  });
});
