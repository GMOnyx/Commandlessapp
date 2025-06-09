import { GoogleGenerativeAI } from '@google/generative-ai';
import { log } from '../vite';
import { maskSensitiveData } from '../utils/encryption';

// Initialize Gemini client with API key from environment variables
export const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Validate that Gemini API is properly configured
 * @returns True if configured, false otherwise
 */
export function validateGeminiConfig(): boolean {
  console.log('[GEMINI] Validating configuration...');
  
  if (!process.env.GEMINI_API_KEY) {
    console.log('[GEMINI] ❌ GEMINI_API_KEY not found in environment variables');
    return false;
  }
  
  if (process.env.GEMINI_API_KEY.length > 10) {
    console.log(`[GEMINI] ✅ GEMINI_API_KEY configured: ${maskSensitiveData(process.env.GEMINI_API_KEY, 6)}`);
    return true;
  }
  
  console.log('[GEMINI] ❌ GEMINI_API_KEY appears to be invalid (too short)');
  return false;
} 