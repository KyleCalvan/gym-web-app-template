import { randomBytes, scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';

const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const HASH_PATTERN = /^scrypt:16384:8:1:([A-Za-z0-9_-]{22}):([A-Za-z0-9_-]{86})$/;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => callbackScrypt(password, salt, KEY_LENGTH,
    { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION }, (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt:${COST}:${BLOCK_SIZE}:${PARALLELIZATION}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: string | null) {
  const match = storedHash?.match(HASH_PATTERN);
  const salt = match ? Buffer.from(match[1], 'base64url') : Buffer.alloc(16);
  const expected = match ? Buffer.from(match[2], 'base64url') : Buffer.alloc(KEY_LENGTH);
  const actual = await derive(password, salt);
  return Boolean(match && salt.length === 16 && expected.length === KEY_LENGTH && timingSafeEqual(actual, expected));
}
