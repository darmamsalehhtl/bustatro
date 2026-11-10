import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const PREFIX = 'scrypt';

// Stored as "scrypt$<salt hex>$<hash hex>".

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return format(salt, hash);
}

export function hashPasswordSync(password) {
  const salt = randomBytes(16);
  return format(salt, scryptSync(password, salt, KEY_LENGTH));
}

export async function verifyPassword(password, stored) {
  const [prefix, saltHex, hashHex] = stored.split('$');
  if (prefix !== PREFIX || !saltHex || !hashHex) {
    throw new Error('Stored password is not a scrypt hash');
  }
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function isHashed(stored) {
  return stored.startsWith(`${PREFIX}$`);
}

// Compared against when a username does not exist, so a failed login takes
// as long as a wrong password and does not reveal which usernames exist.
export const DUMMY_HASH = hashPasswordSync(randomBytes(16).toString('hex'));

function format(salt, hash) {
  return `${PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`;
}
