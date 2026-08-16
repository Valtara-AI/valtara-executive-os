// AES-256-GCM field-level encryption helpers, keyed by DB_ENCRYPTION_KEY
// (SEC-001 §4.1). Not exercised by any Sprint 1 write path — no
// IntegrationToken rows are written until Sprint 4+ — but present now so
// that table and Voice Profile sensitive fields have a ready helper when
// needed, rather than retrofitting encryption after data already exists.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

function getKey(): Buffer {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("DB_ENCRYPTION_KEY must be set (see .env.example).");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("DB_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return buf;
}

// Encrypted value format: base64(iv) + "." + base64(authTag) + "." + base64(ciphertext)
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptField(encoded: string): string {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted field value.");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
