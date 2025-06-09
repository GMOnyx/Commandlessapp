import OpenAI from 'openai';
import { log } from '../vite';

// Initialize OpenAI client with API key from environment variables
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Validate that OpenAI API is properly configured
 * @returns True if configured, false otherwise
 */
export function validateOpenAIConfig(): boolean {
  if (!process.env.OPENAI_API_KEY) {
    log('OpenAI API key is not set. Intent processing will be disabled.', 'openai');
    return false;
  }
  
  if (process.env.OPENAI_API_KEY.startsWith('sk-')) {
    return true;
  } else {
    log('Invalid OpenAI API key format. Intent processing may not work correctly.', 'openai');
    return false;
  }
} 