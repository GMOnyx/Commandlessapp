import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to decode JWT and extract user ID
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decodedToken = decodeJWT(token);
  
  if (!decodedToken) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const userId = decodedToken.userId;

  try {
    // Ensure user exists in database (auto-create if needed)
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('User check error:', userError);
      return res.status(500).json({ error: 'User verification failed' });
    }

    if (!existingUser) {
      console.log('Creating new user record for:', userId);
      const { error: createError } = await supabase
        .from('users')
        .insert({
          id: userId,
          username: userId,
          name: userId,
          role: 'user'
        });
      if (createError) {
        console.error('Failed to create user:', createError);
        return res.status(500).json({ error: 'Failed to create user record' });
      }
    }

    if (req.method === 'GET') {
      // Get all command mappings for the user
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
          created_at,
          bots!inner (
            id,
            bot_name,
            platform_type,
            is_connected
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedMappings = mappings.map((mapping: any) => ({
        id: mapping.id,
        botId: mapping.bot_id,
        name: mapping.name,
        naturalLanguagePattern: mapping.natural_language_pattern,
        commandOutput: mapping.command_output,
        status: mapping.status,
        usageCount: mapping.usage_count,
        createdAt: mapping.created_at,
        bot: {
          id: mapping.bots.id,
          botName: mapping.bots.bot_name,
          platformType: mapping.bots.platform_type,
          isConnected: mapping.bots.is_connected
        }
      }));

      return res.status(200).json(formattedMappings);
    }

    if (req.method === 'POST') {
      // Create new command mapping
      const { botId, name, naturalLanguagePattern, commandOutput, status = 'active' } = req.body;
      
      if (!botId || !name || !naturalLanguagePattern || !commandOutput) {
        return res.status(400).json({ error: 'Missing required fields: botId, name, naturalLanguagePattern, commandOutput' });
      }

      // Verify bot exists and belongs to user
      const { data: bot, error: botError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (botError || !bot) {
        return res.status(404).json({ error: 'Bot not found or access denied' });
      }

      const { data: newMapping, error } = await supabase
        .from('command_mappings')
        .insert({
          user_id: userId,
          bot_id: botId,
          name: name,
          natural_language_pattern: naturalLanguagePattern,
          command_output: commandOutput,
          status: status
        })
        .select('*')
        .single();

      if (error) throw error;

      // Create activity
      await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: 'command_created',
          description: `Command mapping ${name} was created`,
          metadata: { mappingId: newMapping.id, botId: botId }
        });

      const formattedMapping = {
        id: newMapping.id,
        botId: newMapping.bot_id,
        name: newMapping.name,
        naturalLanguagePattern: newMapping.natural_language_pattern,
        commandOutput: newMapping.command_output,
        status: newMapping.status,
        usageCount: newMapping.usage_count,
        createdAt: newMapping.created_at
      };

      return res.status(201).json(formattedMapping);
    }

    if (req.method === 'PUT') {
      // Update command mapping
      const { mappingId } = req.query;
      const { name, naturalLanguagePattern, commandOutput, status } = req.body;
      
      if (!mappingId) {
        return res.status(400).json({ error: 'Mapping ID is required' });
      }

      const { data: mapping, error: fetchError } = await supabase
        .from('command_mappings')
        .select('*')
        .eq('id', mappingId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !mapping) {
        return res.status(404).json({ error: 'Command mapping not found' });
      }

      const updatedData: any = {};
      if (name !== undefined) updatedData.name = name;
      if (naturalLanguagePattern !== undefined) updatedData.natural_language_pattern = naturalLanguagePattern;
      if (commandOutput !== undefined) updatedData.command_output = commandOutput;
      if (status !== undefined) updatedData.status = status;

      const { data: updatedMapping, error } = await supabase
        .from('command_mappings')
        .update(updatedData)
        .eq('id', mappingId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) throw error;

      const formattedMapping = {
        id: updatedMapping.id,
        botId: updatedMapping.bot_id,
        name: updatedMapping.name,
        naturalLanguagePattern: updatedMapping.natural_language_pattern,
        commandOutput: updatedMapping.command_output,
        status: updatedMapping.status,
        usageCount: updatedMapping.usage_count,
        createdAt: updatedMapping.created_at
      };

      return res.status(200).json(formattedMapping);
    }

    if (req.method === 'DELETE') {
      // Delete command mapping
      const { mappingId } = req.query;
      
      if (!mappingId) {
        return res.status(400).json({ error: 'Mapping ID is required' });
      }

      const { data: mapping, error: fetchError } = await supabase
        .from('command_mappings')
        .select('*')
        .eq('id', mappingId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !mapping) {
        return res.status(404).json({ error: 'Command mapping not found' });
      }

      const { error } = await supabase
        .from('command_mappings')
        .delete()
        .eq('id', mappingId)
        .eq('user_id', userId);

      if (error) throw error;

      // Create activity
      await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: 'command_deleted',
          description: `Command mapping ${mapping.name} was deleted`,
          metadata: { 
            mappingId: mapping.id, 
            botId: mapping.bot_id,
            commandName: mapping.name
          }
        });

      return res.status(200).json({ 
        success: true, 
        message: `Command mapping "${mapping.name}" has been deleted successfully` 
      });
    }

    return res.status(400).json({ error: 'Invalid request method' });

  } catch (error) {
    console.error('Mappings API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
} 