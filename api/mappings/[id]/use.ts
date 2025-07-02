import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to decode JWT and extract user ID (same as mappings.ts)
function decodeJWT(token: string): { userId: string } | null {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      // If it's not a JWT, treat it as a direct user ID (for backward compatibility)
      return { userId: token };
    }
    
    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    
    // Extract user ID from Clerk JWT payload
    const userId = payload.sub || payload.user_id || payload.id;
    
    if (!userId) {
      console.error('No user ID found in JWT payload:', payload);
      return null;
    }
    
    return { userId };
  } catch (error) {
    console.error('Error decoding JWT:', error);
    // Fallback: treat the token as a direct user ID
    return { userId: token };
  }
}

export default async function handler(req: any, res: any) {
  // Universal CORS headers - accept custom domain or any Vercel URL
  const origin = req.headers.origin;
  const isAllowedOrigin = origin && (
    origin === 'https://www.commandless.app' ||
    origin === 'https://commandless.app' ||
    origin === 'http://localhost:5173' ||
    origin.endsWith('.vercel.app')
  );
  
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from auth token (same method as mappings.ts)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const userId = decodedToken.userId;

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
      .eq('user_id', userId)
      .single();

    const newUsageCount = (currentMapping?.usage_count || 0) + 1;

    const { data: updatedMapping, error: updateError } = await supabase
      .from('command_mappings')
      .update({ 
        usage_count: newUsageCount
      })
      .eq('id', id)
      .eq('user_id', userId)
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
        user_id: userId,
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