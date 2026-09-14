import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey() {
  const configured = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error("INTEGRATIONS_ENCRYPTION_KEY não configurada.");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY precisa ter 32 bytes em Base64.");
  }
  return key;
}

export function encryptIntegrationSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptIntegrationSecret(payload: string) {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Segredo de integração inválido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
