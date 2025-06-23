import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    let messageContent = '';
    let botId = '';
    let userId = '';

    // Handle Universal Relay Service format vs standard format
    if (body.message && typeof body.message === 'object' && body.message.content) {
      // Universal Relay Service format
      messageContent = body.message.content;
      botId = body.botClientId || 'unknown';
      userId = body.message.author?.id || 'unknown';
      
      console.log(`📨 NEW API (URS Format): Processing message: "${messageContent}" for bot ${botId}`);
      
      // Return response in Universal Relay Service expected format
      const response = "🎉 Hey! The new API is working with Universal Relay Service! Your sophisticated AI system will be added next.";
      
      return res.status(200).json({
        processed: true,
        response: response,
        execution: null
      });
      
    } else if (body.action === 'process-message') {
      // Standard format
      messageContent = body.message;
      botId = body.botId;
      userId = body.userId;
      
      console.log(`📨 NEW API (Standard Format): Processing message: "${messageContent}" for bot ${botId}`);
      
      const response = "Hey! The new API is working with standard format! Your sophisticated AI system will be added next.";
      
      return res.status(200).json({
        success: true,
        response: response,
        shouldExecute: false,
        command: null
      });
    }

    return res.status(400).json({ error: 'Invalid message format' });
  } catch (error) {
    console.error('Error processing message:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      response: "Sorry, I encountered an error. Please try again."
    });
  }
}
