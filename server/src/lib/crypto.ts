import crypto from 'node:crypto';

// AES-256-GCM authenticated encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
  const secret = process.env.APP_SECRET || process.env.JWT_SECRET || 'devflow-default-encryption-secret-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plain-text secret token using AES-256-GCM
 */
export function encryptSecret(plainText: string): { encrypted: string; iv: string; tag: string } {
  if (!plainText) {
    throw new Error('Cannot encrypt empty text');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted secret token
 */
export function decryptSecret(encryptedHex: string, ivHex: string, tagHex: string): string {
  if (!encryptedHex || !ivHex || !tagHex) {
    throw new Error('Missing encryption parameters');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Mask a token for display in the UI (e.g. ghp_••••••••abcd)
 */
export function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '••••••••';
  const prefix = token.slice(0, 4);
  const suffix = token.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

