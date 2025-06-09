import { createVerify } from 'crypto';
import { log } from '../vite';

/**
 * Verify a Discord webhook signature
 * 
 * @param publicKey Discord application public key
 * @param signature Ed25519 signature from Discord
 * @param timestamp Timestamp from Discord
 * @param body Request body string
 * @returns True if signature is valid, false otherwise
 */
export function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  try {
    if (!publicKey || !signature || !timestamp || !body) {
      log('Missing parameters for Discord signature verification', 'discord');
      return false;
    }

    // Create the message that was signed (timestamp + body)
    const message = timestamp + body;
    
    // Convert hex signature to Buffer
    const signatureBuffer = Buffer.from(signature, 'hex');
    
    // Use crypto's verify function
    const verify = createVerify('sha512');
    verify.update(message);
    
    // Discord uses the Ed25519 algorithm
    return verify.verify(
      `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`,
      signatureBuffer
    );
  } catch (error) {
    log(`Error verifying Discord signature: ${(error as Error).message}`, 'discord');
    return false;
  }
} 