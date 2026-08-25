/**
 * Password hashing for the on-device account.
 *
 * Stored as `pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>`. The parameters
 * travel with the hash so the cost can be raised later without locking anyone
 * out — `needsRehash` reports when a stored value is behind the current scheme.
 *
 * The scheme this replaced was a single unsalted-stretch `SHA256(salt + password)`,
 * which a stolen device database gives up to a dictionary attack almost for free.
 * Values in that old `salt:hash` shape still verify, once, so the app can
 * upgrade them on the next successful sign-in.
 */

import * as Crypto from "expo-crypto";
import { DIGEST_BYTES, hmacKey, hmacShort } from "./sha256";

export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const PREFIX = "pbkdf2-sha256";

/* ── encoding ────────────────────────────────────────────────────────────── */

function toHex(bytes: Uint8Array): string {
  let hex = "";

  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }

  return hex;
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

function toUtf8(text: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text);
  }

  // Hermes has TextEncoder, but a manual encoder keeps this safe on older runtimes.
  const bytes: number[] = [];

  for (const character of text) {
    let point = character.codePointAt(0) ?? 0;

    if (point < 0x80) {
      bytes.push(point);
    } else if (point < 0x800) {
      bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    } else if (point < 0x10000) {
      bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
    } else {
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
      point = 0;
    }
  }

  return Uint8Array.from(bytes);
}

/* ── derivation ──────────────────────────────────────────────────────────── */

type SubtleLike = {
  importKey: (
    format: "raw",
    keyData: Uint8Array,
    algorithm: string,
    extractable: boolean,
    usages: string[],
  ) => Promise<object>;
  deriveBits: (
    algorithm: { name: string; hash: string; salt: Uint8Array; iterations: number },
    key: object,
    length: number,
  ) => Promise<ArrayBuffer>;
};

/** WebCrypto does PBKDF2 natively. Present in the PWA build, absent on Hermes. */
function webSubtle(): SubtleLike | null {
  const host = globalThis as { crypto?: { subtle?: SubtleLike } };

  return host.crypto?.subtle ?? null;
}

function pbkdf2Js(password: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  const key = hmacKey(password);
  const seed = new Uint8Array(salt.length + 4);

  seed.set(salt);
  // One 32-byte output block, so the big-endian block counter is always 1.
  seed[salt.length + 3] = 1;

  let previous = hmacShort(key, seed);
  const accumulated = previous.slice();

  for (let i = 1; i < iterations; i += 1) {
    previous = hmacShort(key, previous);

    for (let j = 0; j < DIGEST_BYTES; j += 1) {
      accumulated[j] ^= previous[j];
    }
  }

  return accumulated;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const passwordBytes = toUtf8(password);
  const subtle = webSubtle();

  if (subtle) {
    try {
      const key = await subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveBits"]);
      const bits = await subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations },
        key,
        DIGEST_BYTES * 8,
      );

      return new Uint8Array(bits);
    } catch {
      // Fall through — a runtime that advertises `subtle` may still lack PBKDF2.
    }
  }

  return pbkdf2Js(passwordBytes, salt, iterations);
}

/* ── legacy scheme ───────────────────────────────────────────────────────── */

const LEGACY_PATTERN = /^[^$:]+:[0-9a-f]{64}$/i;

function isLegacy(stored: string): boolean {
  return LEGACY_PATTERN.test(stored);
}

async function verifyLegacy(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(":");

  if (!salt || !expected) {
    return false;
  }

  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + password);

  return equalStrings(hash.toLowerCase(), expected.toLowerCase());
}

/* ── public API ──────────────────────────────────────────────────────────── */

/** Length-independent comparison, so a mismatch leaks no position information. */
function equalStrings(left: string, right: string): boolean {
  let diff = left.length ^ right.length;

  for (let i = 0; i < left.length && i < right.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }

  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = Crypto.getRandomBytes(SALT_BYTES);
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);

  return `${PREFIX}$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (isLegacy(stored)) {
    return verifyLegacy(password, stored);
  }

  const [prefix, iterationsPart, saltHex, hashHex] = stored.split("$");

  if (prefix !== PREFIX || !iterationsPart || !saltHex || !hashHex) {
    return false;
  }

  const iterations = Number(iterationsPart);

  if (!Number.isInteger(iterations) || iterations < 1) {
    return false;
  }

  const hash = await derive(password, fromHex(saltHex), iterations);

  return equalStrings(toHex(hash), hashHex.toLowerCase());
}

/**
 * True when a stored hash uses the old scheme or a weaker cost than the current
 * one. Callers hold the plaintext only during sign-in, so that is the one
 * moment an upgrade is possible.
 */
export function needsRehash(stored: string): boolean {
  if (isLegacy(stored)) {
    return true;
  }

  const [prefix, iterationsPart] = stored.split("$");

  if (prefix !== PREFIX) {
    return true;
  }

  return Number(iterationsPart) < PBKDF2_ITERATIONS;
}
