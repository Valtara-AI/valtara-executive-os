import { describe, expect, it, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptField, decryptField } from "./crypto.js";

beforeAll(() => {
  process.env.DB_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptField / decryptField", () => {
  it("round-trips a plaintext value", () => {
    const plaintext = "ya29.a0AfH6SMC-fake-oauth-access-token";
    const encrypted = encryptField(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptField(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (unique nonce)", () => {
    const plaintext = "same-input-both-times";
    const first = encryptField(plaintext);
    const second = encryptField(plaintext);
    expect(first).not.toBe(second);
    expect(decryptField(first)).toBe(plaintext);
    expect(decryptField(second)).toBe(plaintext);
  });

  it("rejects a tampered ciphertext", () => {
    const encrypted = encryptField("sensitive-value");
    const [iv, authTag, ciphertext] = encrypted.split(".");
    const tampered = `${iv}.${authTag}.${ciphertext?.slice(0, -4)}AAAA`;
    expect(() => decryptField(tampered)).toThrow();
  });
});
