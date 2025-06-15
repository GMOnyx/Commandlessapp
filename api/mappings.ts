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

    if (req.method === 'GET') {
      // Get real command mappings from Supabase
      const { data: mappings, error } = await supabase
        .from('command_mappings')
        .select(`
          id,
          bot_id,
          name,
          natural_language_pattern,
          command_output,
          status,
          usage_count,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Failed to fetch command mappings' });
      }

      // Get bot information for each mapping
      const commandMappings: any[] = [];
      if (mappings && mappings.length > 0) {
        const botIds = [...new Set(mappings.map(m => m.bot_id))];
        const { data: bots } = await supabase
          .from('bots')
          .select('id, bot_name, platform_type')
          .in('id', botIds);

        const botMap = new Map(bots?.map(bot => [bot.id, bot]) || []);

        for (const mapping of mappings) {
          const bot = botMap.get(mapping.bot_id);
          commandMappings.push({
            id: mapping.id,
            botId: mapping.bot_id,
            name: mapping.name,
            naturalLanguagePattern: mapping.natural_language_pattern,
            commandOutput: mapping.command_output,
            status: mapping.status,
            usageCount: mapping.usage_count,
            createdAt: mapping.created_at,
            bot: bot ? {
              id: bot.id,
              name: bot.bot_name,
              type: bot.platform_type
            } : null
          });
        }
      }
      
      return res.status(200).json(commandMappings);
    }

    if (req.method === 'POST') {
      // Handle new command mapping
      const { botId, name, naturalLanguagePattern, commandOutput } = req.body;
      
      // Basic validation
      if (!botId || !name || !naturalLanguagePattern || !commandOutput) {
        return res.status(400).json({ 
          error: 'Missing required fields: botId, name, naturalLanguagePattern, and commandOutput' 
        });
      }

      // Verify the bot belongs to the user
      const { data: bot, error: botError } = await supabase
        .from('bots')
        .select('id, bot_name, platform_type')
        .eq('id', botId)
        .eq('user_id', user.id)
        .single();

      if (botError || !bot) {
        return res.status(400).json({ error: 'Invalid bot ID or bot does not belong to user' });
      }

      // Insert new command mapping into database
      const { data: newMapping, error: insertError } = await supabase
        .from('command_mappings')
        .insert({
          user_id: user.id,
          bot_id: botId,
          name,
          natural_language_pattern: naturalLanguagePattern,
          command_output: commandOutput,
          status: 'active',
          usage_count: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        return res.status(500).json({ error: 'Failed to save command mapping' });
      }

      // Log activity
      await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          activity_type: 'command_created',
          description: `Created command mapping: ${name}`,
          metadata: { 
            mappingId: newMapping.id, 
            botId: botId,
            botName: bot.bot_name 
          }
        });

      // Return the created mapping with bot info
      const responseMapping = {
        id: newMapping.id,
        botId: newMapping.bot_id,
        name: newMapping.name,
        naturalLanguagePattern: newMapping.natural_language_pattern,
        commandOutput: newMapping.command_output,
        status: newMapping.status,
        usageCount: newMapping.usage_count,
        createdAt: newMapping.created_at,
        bot: {
          id: bot.id,
          name: bot.bot_name,
          type: bot.platform_type
        }
      };

      return res.status(201).json(responseMapping);
    }

    if (req.method === 'PUT') {
      // Handle updating command mapping
      const { id } = req.query;
      const { name, naturalLanguagePattern, commandOutput, status } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing mapping ID' });
      }

      // Update the mapping (only if it belongs to the user)
      const { data: updatedMapping, error: updateError } = await supabase
        .from('command_mappings')
        .update({
          ...(name && { name }),
          ...(naturalLanguagePattern && { natural_language_pattern: naturalLanguagePattern }),
          ...(commandOutput && { command_output: commandOutput }),
          ...(status && { status }),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Database update error:', updateError);
        return res.status(500).json({ error: 'Failed to update command mapping' });
      }

      if (!updatedMapping) {
        return res.status(404).json({ error: 'Command mapping not found' });
      }

      return res.status(200).json(updatedMapping);
    }

    if (req.method === 'DELETE') {
      // Handle deleting command mapping
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Missing mapping ID' });
      }

      // Delete the mapping (only if it belongs to the user)
      const { error: deleteError } = await supabase
        .from('command_mappings')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Database delete error:', deleteError);
        return res.status(500).json({ error: 'Failed to delete command mapping' });
      }

      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Command mappings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 