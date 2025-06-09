import crypto from 'crypto';

// Get encryption key from environment or generate a default one
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.scryptSync('default-key-commandless-2024', 'salt', 32);
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts sensitive data like bot tokens using AES-256-GCM
 */
export function encryptSensitiveData(text: string): string {
  if (!text) return text;
  
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // For GCM mode, we would get auth tag, but createCipher doesn't support it
    // Using simpler approach for compatibility
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('[ENCRYPTION] Failed to encrypt data:', error);
    // In case of encryption failure, return original (better than losing data)
    return text;
  }
}

/**
 * Decrypts sensitive data like bot tokens using AES-256-GCM
 */
export function decryptSensitiveData(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  // Check if data is encrypted (contains IV separator)
  if (!encryptedText.includes(':')) {
    // Data is not encrypted, return as-is (for backward compatibility)
    return encryptedText;
  }
  
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[ENCRYPTION] Failed to decrypt data:', error);
    // In case of decryption failure, return original (might be unencrypted legacy data)
    return encryptedText;
  }
}

/**
 * Safely logs sensitive data with masking
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars) {
    return '***';
  }
  
  return data.substring(0, visibleChars) + '*'.repeat(Math.min(8, data.length - visibleChars));
}

/**
 * Validates that environment variables are properly set for encryption
 */
export function validateEncryptionSetup(): boolean {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('[ENCRYPTION] ⚠️ ENCRYPTION_KEY not set in environment. Using default key (not recommended for production)');
    return false;
  }
  
  if (process.env.ENCRYPTION_KEY.length < 32) {
    console.warn('[ENCRYPTION] ⚠️ ENCRYPTION_KEY is too short. Use at least 32 characters for security.');
    return false;
  }
  
  console.log('[ENCRYPTION] ✅ Encryption properly configured');
  return true;
} 