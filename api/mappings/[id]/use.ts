import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getUserFromToken(token: string) {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY not configured');
    }

    const sessionToken = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    
    if (sessionToken && sessionToken.sub) {
      return { 
        id: sessionToken.sub,
        clerkUserId: sessionToken.sub 
      };
    }
    return null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Extract mapping ID from URL
    const { id } = req.query;
    const { input, response } = req.body;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    // Increment usage count
    const { data: currentMapping } = await supabase
      .from('command_mappings')
      .select('usage_count')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    const newUsageCount = (currentMapping?.usage_count || 0) + 1;

    const { data: updatedMapping, error: updateError } = await supabase
      .from('command_mappings')
      .update({ 
        usage_count: newUsageCount
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !updatedMapping) {
      console.error('Update error:', updateError);
      return res.status(404).json({ error: 'Failed to update mapping or mapping not found' });
    }

    // Log usage activity
    await supabase
      .from('activities')
      .insert({
        user_id: user.id,
        activity_type: 'mapping_used',
        description: `Used mapping: ${updatedMapping.name}`,
        metadata: { 
          mappingId: updatedMapping.id,
          input: input || 'Unknown input',
          response: response || updatedMapping.command_output,
          usageCount: updatedMapping.usage_count
        }
      });

    return res.status(200).json({
      id: updatedMapping.id,
      usageCount: updatedMapping.usage_count,
      message: 'Mapping usage recorded successfully'
    });
  } catch (error) {
    console.error('Mapping use API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 