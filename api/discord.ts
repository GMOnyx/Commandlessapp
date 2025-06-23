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
    const { action, message, botId, userId, context } = req.body;

    if (action === 'process-message') {
      console.log(`📨 NEW API: Processing message: "${message}" for bot ${botId}`);
      
      // Simple response for now to test the new API is working
      const response = "Hey! The new API is working! Your sophisticated AI system will be added next.";
      
      return res.status(200).json({
        success: true,
        response: response,
        shouldExecute: false,
        command: null
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Error processing message:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      response: "Sorry, I encountered an error. Please try again."
    });
  }
}
