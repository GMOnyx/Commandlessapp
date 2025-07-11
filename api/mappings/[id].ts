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

    // Extract mapping ID from URL
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    if (req.method === 'GET') {
      // Get specific mapping
      const { data: mapping, error } = await supabase
        .from('command_mappings')
        .select(`
          id,
          bot_id,
          name,
          natural_language_pattern,
          command_output,
          personality_context,
          status,
          usage_count,
          created_at
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error || !mapping) {
        return res.status(404).json({ error: 'Mapping not found' });
      }

      // Get bot information separately
      const { data: bot } = await supabase
        .from('bots')
        .select('id, bot_name, platform_type')
        .eq('id', mapping.bot_id)
        .single();

      const response = {
        id: mapping.id,
        botId: mapping.bot_id,
        name: mapping.name,
        naturalLanguagePattern: mapping.natural_language_pattern,
        commandOutput: mapping.command_output,
        personalityContext: mapping.personality_context,
        status: mapping.status,
        usageCount: mapping.usage_count,
        createdAt: mapping.created_at,
        bot: bot ? {
          id: bot.id,
          name: bot.bot_name,
          platformType: bot.platform_type
        } : null
      };

      return res.status(200).json(response);
    }

    if (req.method === 'PUT') {
      // Update mapping
      const { 
        name,
        naturalLanguagePattern,
        commandOutput,
        personalityContext,
        status 
      } = req.body;

      const updateData: any = {};
      
      if (name !== undefined) updateData.name = name;
      if (naturalLanguagePattern !== undefined) updateData.natural_language_pattern = naturalLanguagePattern;
      if (commandOutput !== undefined) updateData.command_output = commandOutput;
      if (personalityContext !== undefined) updateData.personality_context = personalityContext;
      if (status !== undefined) updateData.status = status;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const { data: updatedMapping, error: updateError } = await supabase
        .from('command_mappings')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select(`
          id,
          bot_id,
          name,
          natural_language_pattern,
          command_output,
          personality_context,
          status,
          usage_count,
          created_at
        `)
        .single();

      if (updateError || !updatedMapping) {
        console.error('Update error:', updateError);
        return res.status(404).json({ error: 'Failed to update mapping or mapping not found' });
      }

      const response = {
        id: updatedMapping.id,
        botId: updatedMapping.bot_id,
        name: updatedMapping.name,
        naturalLanguagePattern: updatedMapping.natural_language_pattern,
        commandOutput: updatedMapping.command_output,
        personalityContext: updatedMapping.personality_context,
        status: updatedMapping.status,
        usageCount: updatedMapping.usage_count,
        createdAt: updatedMapping.created_at
      };

      return res.status(200).json(response);
    }

    if (req.method === 'DELETE') {
      // Delete mapping
      const { error: deleteError } = await supabase
        .from('command_mappings')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return res.status(500).json({ error: 'Failed to delete mapping' });
      }

      return res.status(200).json({ message: 'Mapping deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Mapping detail API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 