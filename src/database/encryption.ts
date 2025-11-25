import * as crypto from 'crypto';
import { EncryptionError } from '../api/middleware/errorHandler';

// AES-256 requires a 32-byte key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Derives a 32-byte key from the encryption key using PBKDF2
 */
function deriveKey(key: string): Buffer {
  // Use a fixed salt for key derivation (in production, this should be configurable)
  const salt = process.env.ENCRYPTION_SALT || 'rentema-encryption-salt';
  return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
}

/**
 * Encrypts credentials using AES-256-GCM
 * @param credentials - The credentials object to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex encoded)
 */
export function encryptCredentials(credentials: Record<string, any>): string {
  try {
    const jsonString = JSON.stringify(credentials);
    const key = deriveKey(ENCRYPTION_KEY);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new EncryptionError(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts credentials using AES-256-GCM
 * @param encryptedData - Encrypted string in format: iv:authTag:encryptedData
 * @returns Decrypted credentials object
 */
export function decryptCredentials(encryptedData: string): Record<string, any> {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new EncryptionError('Invalid encrypted data format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const key = deriveKey(ENCRYPTION_KEY);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates that encryption key is properly configured
 */
export function validateEncryptionKey(): boolean {
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === 'default-encryption-key-change-in-production') {
    console.warn('WARNING: Using default encryption key. Set ENCRYPTION_KEY environment variable in production.');
    return false;
  }
  if (ENCRYPTION_KEY.length < 32) {
    console.warn('WARNING: Encryption key should be at least 32 characters for optimal security.');
    return false;
  }
  return true;
}
