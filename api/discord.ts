import { discordWebhookHandler } from '../server/discord/webhook';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Forward the request to our webhook handler
  return await discordWebhookHandler(req, res);
} 