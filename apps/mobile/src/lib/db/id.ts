import * as Crypto from "expo-crypto";

/**
 * Primary keys for every local table. `Math.random` is not a source of
 * uniqueness — two rows inserted in the same tick could collide, and the
 * sequence is predictable from a single observed id.
 */
export function generateId(): string {
  return Crypto.randomUUID();
}
