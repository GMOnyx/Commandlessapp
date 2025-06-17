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
    const { testInput } = req.body;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    if (!testInput) {
      return res.status(400).json({ error: 'Test input is required' });
    }

    // Get the mapping
    const { data: mapping, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    // Simple pattern matching for testing
    const pattern = mapping.natural_language_pattern.toLowerCase();
    const input = testInput.toLowerCase();
    
    // Basic pattern matching - check if input contains key words from pattern
    const patternWords = pattern.split(/\s+/).filter(word => word.length > 2);
    const inputWords = input.split(/\s+/);
    
    const matchedWords = patternWords.filter(patternWord => 
      inputWords.some(inputWord => inputWord.includes(patternWord) || patternWord.includes(inputWord))
    );
    
    const confidence = patternWords.length > 0 ? matchedWords.length / patternWords.length : 0;
    const isMatch = confidence > 0.5; // 50% threshold

    // Log test activity
    await supabase
      .from('activities')
      .insert({
        user_id: user.id,
        activity_type: 'mapping_tested',
        description: `Tested mapping: ${mapping.name}`,
        metadata: { 
          mappingId: mapping.id,
          testInput,
          matched: isMatch,
          confidence
        }
      });

    return res.status(200).json({
      matched: isMatch,
      confidence: Math.round(confidence * 100),
      response: isMatch ? mapping.command_output : 'No match found',
      testInput,
      pattern: mapping.natural_language_pattern
    });
  } catch (error) {
    console.error('Mapping test API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 