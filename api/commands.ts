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

    if (req.method === 'POST') {
      const { 
        botId,
        name,
        naturalLanguagePattern,
        commandOutput,
        personalityContext 
      } = req.body;
      
      // Basic validation
      if (!botId || !name || !naturalLanguagePattern || !commandOutput) {
        return res.status(400).json({ 
          error: 'Missing required fields: botId, name, naturalLanguagePattern, commandOutput' 
        });
      }

      // Insert new command mapping
      const { data: newMapping, error: insertError } = await supabase
        .from('command_mappings')
        .insert({
          user_id: user.id,
          bot_id: botId,
          name,
          natural_language_pattern: naturalLanguagePattern,
          command_output: commandOutput,
          personality_context: personalityContext || null,
          status: 'active',
          usage_count: 0
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        return res.status(500).json({ error: 'Failed to create command mapping' });
      }

      // Return the created mapping
      const responseMapping = {
        id: newMapping.id,
        botId: newMapping.bot_id,
        name: newMapping.name,
        naturalLanguagePattern: newMapping.natural_language_pattern,
        commandOutput: newMapping.command_output,
        personalityContext: newMapping.personality_context,
        status: newMapping.status,
        usageCount: newMapping.usage_count,
        createdAt: newMapping.created_at
      };

      return res.status(201).json(responseMapping);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Commands API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 