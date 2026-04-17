// AES-256-GCM encryption for GitHub access tokens at rest.
// Key comes from GITHUB_TOKEN_ENCRYPTION_KEY env var (base64-encoded 32 bytes).
//
// Storing OAuth tokens as plaintext in the DB is a recipe for disaster if the
// DB is ever dumped. Encrypting with a key that lives only in env vars means
// a DB leak alone can't decrypt the tokens — the attacker also needs the env.

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit IV recommended for GCM

function key(): Buffer {
  const raw = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "GITHUB_TOKEN_ENCRYPTION_KEY is not set. " +
        "Generate with: openssl rand -base64 32"
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `GITHUB_TOKEN_ENCRYPTION_KEY must decode to 32 bytes, got ${buf.length}.`
    );
  }
  return buf;
}

/** Encrypts `plaintext` and returns a compact "<iv>.<tag>.<ciphertext>" string. */
export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

/** Reverse of `encryptToken`. Throws if tampered or wrong key. */
export function decryptToken(blob: string): string {
  const [ivB64, tagB64, ctB64] = blob.split(".");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Malformed encrypted token blob");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ct = Buffer.from(ctB64, "base64url");
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
