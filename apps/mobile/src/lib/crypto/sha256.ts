/**
 * SHA-256 and HMAC-SHA256, in JavaScript.
 *
 * `expo-crypto` only exposes an *async* native digest, so a 100,000-iteration
 * PBKDF2 would cost 200,000 bridge round-trips — minutes, not milliseconds.
 * The compression function therefore lives here. See `password.ts`, which
 * prefers WebCrypto whenever the platform actually has it.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL_STATE = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const BLOCK_BYTES = 64;
export const DIGEST_BYTES = 32;

/** Reused across every call — the hot loop must not allocate. */
const schedule = new Uint32Array(64);

/** Absorbs one 64-byte block of `input` at `offset` into `state`, in place. */
function compress(state: Uint32Array, input: Uint8Array, offset: number) {
  for (let i = 0; i < 16; i += 1) {
    const j = offset + i * 4;
    schedule[i] = ((input[j] << 24) | (input[j + 1] << 16) | (input[j + 2] << 8) | input[j + 3]) >>> 0;
  }

  for (let i = 16; i < 64; i += 1) {
    const x = schedule[i - 15];
    const y = schedule[i - 2];
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    schedule[i] = (schedule[i - 16] + s0 + schedule[i - 7] + s1) | 0;
  }

  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];
  let f = state[5];
  let g = state[6];
  let h = state[7];

  for (let i = 0; i < 64; i += 1) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i] + schedule[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;

    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }

  state[0] = (state[0] + a) | 0;
  state[1] = (state[1] + b) | 0;
  state[2] = (state[2] + c) | 0;
  state[3] = (state[3] + d) | 0;
  state[4] = (state[4] + e) | 0;
  state[5] = (state[5] + f) | 0;
  state[6] = (state[6] + g) | 0;
  state[7] = (state[7] + h) | 0;
}

function stateToBytes(state: Uint32Array): Uint8Array {
  const out = new Uint8Array(DIGEST_BYTES);

  for (let i = 0; i < 8; i += 1) {
    const word = state[i];
    out[i * 4] = (word >>> 24) & 0xff;
    out[i * 4 + 1] = (word >>> 16) & 0xff;
    out[i * 4 + 2] = (word >>> 8) & 0xff;
    out[i * 4 + 3] = word & 0xff;
  }

  return out;
}

/**
 * Absorbs a final partial block. `state` must already hold `precedingBlocks`
 * whole blocks, and `tail` must be short enough to leave room for the 0x80
 * marker and the 8-byte length (55 bytes for a single closing block).
 */
function finish(state: Uint32Array, tail: Uint8Array, precedingBlocks: number): Uint8Array {
  const totalBytes = precedingBlocks * BLOCK_BYTES + tail.length;
  const padded = new Uint8Array(tail.length < 56 ? BLOCK_BYTES : BLOCK_BYTES * 2);

  padded.set(tail);
  padded[tail.length] = 0x80;

  const bits = totalBytes * 8;
  const high = Math.floor(bits / 0x100000000);
  const low = bits >>> 0;
  const at = padded.length - 8;

  padded[at] = (high >>> 24) & 0xff;
  padded[at + 1] = (high >>> 16) & 0xff;
  padded[at + 2] = (high >>> 8) & 0xff;
  padded[at + 3] = high & 0xff;
  padded[at + 4] = (low >>> 24) & 0xff;
  padded[at + 5] = (low >>> 16) & 0xff;
  padded[at + 6] = (low >>> 8) & 0xff;
  padded[at + 7] = low & 0xff;

  for (let offset = 0; offset < padded.length; offset += BLOCK_BYTES) {
    compress(state, padded, offset);
  }

  return stateToBytes(state);
}

export function sha256(message: Uint8Array): Uint8Array {
  const state = INITIAL_STATE.slice();
  const wholeBlocks = Math.floor(message.length / BLOCK_BYTES);

  for (let i = 0; i < wholeBlocks; i += 1) {
    compress(state, message, i * BLOCK_BYTES);
  }

  return finish(state, message.subarray(wholeBlocks * BLOCK_BYTES), wholeBlocks);
}

/**
 * The two padded key blocks of HMAC, pre-absorbed. PBKDF2 reuses one key for
 * every iteration, so hashing the pads once removes half the work.
 */
export type HmacKey = {
  innerState: Uint32Array;
  outerState: Uint32Array;
};

export function hmacKey(key: Uint8Array): HmacKey {
  const normalized = key.length > BLOCK_BYTES ? sha256(key) : key;
  const innerPad = new Uint8Array(BLOCK_BYTES);
  const outerPad = new Uint8Array(BLOCK_BYTES);

  innerPad.set(normalized);
  outerPad.set(normalized);

  for (let i = 0; i < BLOCK_BYTES; i += 1) {
    innerPad[i] ^= 0x36;
    outerPad[i] ^= 0x5c;
  }

  const innerState = INITIAL_STATE.slice();
  const outerState = INITIAL_STATE.slice();

  compress(innerState, innerPad, 0);
  compress(outerState, outerPad, 0);

  return { innerState, outerState };
}

/**
 * HMAC-SHA256 of a short message — 55 bytes or fewer, so each half closes in a
 * single block. PBKDF2 only ever feeds it a 32-byte digest or `salt || INT(i)`.
 */
export function hmacShort(key: HmacKey, message: Uint8Array): Uint8Array {
  if (message.length > 55) {
    throw new Error("hmacShort expects a message of 55 bytes or fewer.");
  }

  const inner = finish(key.innerState.slice(), message, 1);

  return finish(key.outerState.slice(), inner, 1);
}
