import OpenAI from 'openai';
import { log } from '../vite';

// Initialize OpenAI client with API key and optional base URL (OpenRouter/Ollama/LocalAI)
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-local',
  baseURL: process.env.OPENAI_BASE_URL, // e.g., https://openrouter.ai/api/v1 or http://localhost:11434/v1
});

/**
 * Validate that OpenAI API is properly configured
 */
export function validateOpenAIConfig(): boolean {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim().length < 10) {
    log('OpenAI-compatible API key is not set. AI processing will be disabled for OpenAI provider.', 'openai');
    return false;
  }
  return true;
}