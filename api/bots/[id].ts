import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// JWT decoding function
function decodeJWT(token: string): { userId: string } | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return { userId: decoded.sub || decoded.user_id || decoded.id };
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enhanced CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.commandless.app',
    'https://commandless.app',
    'https://commandlessapp-ek46aa30u-abdarrahmans-projects.vercel.app',
    'https://commandlessapp-9z79i99ao-abdarrahmans-projects.vercel.app',
    'https://commandlessapp-8y8ryjgo4-abdarrahmans-projects.vercel.app',
    'http://localhost:5173'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authenticate user
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decodedToken = decodeJWT(token);
  
  if (!decodedToken) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { id: botId } = req.query;
  const userId = decodedToken.userId;

  if (!botId || typeof botId !== 'string') {
    return res.status(400).json({ error: 'Bot ID is required' });
  }

  try {
    if (req.method === 'PUT') {
      // Update bot credentials
      const { botName, token: botToken, personalityContext } = req.body;

      if (!botName && !botToken && personalityContext === undefined) {
        return res.status(400).json({ error: 'At least one field must be provided for update' });
      }

      // Get existing bot to verify ownership
      const { data: existingBot, error: fetchError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !existingBot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      // Prepare update data
      const updateData: any = {};
      if (botName) updateData.bot_name = botName;
      if (botToken) updateData.token = botToken;
      if (personalityContext !== undefined) updateData.personality_context = personalityContext;

      // If token is being updated, check for conflicts
      if (botToken && botToken !== existingBot.token) {
        const { data: conflictBot, error: conflictError } = await supabase
          .from('bots')
          .select('id, bot_name, user_id')
          .eq('token', botToken)
          .neq('id', botId)
          .single();

        if (conflictError && conflictError.code !== 'PGRST116') {
          console.error('Error checking for token conflict:', conflictError);
          return res.status(500).json({ error: 'Failed to validate token' });
        }

        if (conflictBot) {
          return res.status(409).json({ 
            error: 'Token already in use',
            details: 'This Discord bot token is already being used by another bot.',
            suggestion: 'Please use a different Discord bot token.'
          });
        }

        // If token is being changed and bot is connected, disconnect it first
        if (existingBot.is_connected) {
          updateData.is_connected = false;
        }
      }

      // Update the bot
      const { data: updatedBot, error: updateError } = await supabase
        .from('bots')
        .update(updateData)
        .eq('id', botId)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating bot:', updateError);
        return res.status(500).json({ 
          error: 'Failed to update bot',
          details: 'There was an error updating your bot. Please try again.'
        });
      }

      // Create activity log
      await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: 'bot_updated',
          description: `Bot "${updatedBot.bot_name}" was updated`,
          metadata: { 
            botId: updatedBot.id,
            changes: Object.keys(updateData)
          }
        });

      // Return formatted response
      const formattedBot = {
        id: updatedBot.id,
        botName: updatedBot.bot_name,
        platformType: updatedBot.platform_type,
        personalityContext: updatedBot.personality_context,
        isConnected: updatedBot.is_connected,
        createdAt: updatedBot.created_at
      };

      return res.status(200).json(formattedBot);
    }

    if (req.method === 'DELETE') {
      // Delete bot
      // Get bot to verify ownership and get details
      const { data: bot, error: fetchError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      // Delete associated command mappings first
      const { error: mappingsError } = await supabase
        .from('command_mappings')
        .delete()
        .eq('bot_id', botId)
        .eq('user_id', userId);

      if (mappingsError) {
        console.error('Error deleting command mappings:', mappingsError);
        // Continue with bot deletion even if mappings deletion fails
      }

      // Delete the bot
      const { error: deleteError } = await supabase
        .from('bots')
        .delete()
        .eq('id', botId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting bot:', deleteError);
        return res.status(500).json({ 
          error: 'Failed to delete bot',
          details: 'There was an error deleting your bot. Please try again.'
        });
      }

      // Create activity log
      await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: 'bot_deleted',
          description: `Bot "${bot.bot_name}" was deleted`,
          metadata: { 
            botId: bot.id,
            botName: bot.bot_name,
            platformType: bot.platform_type
          }
        });

      return res.status(200).json({
        success: true,
        message: `${bot.bot_name} has been deleted successfully.`
      });
    }

    if (req.method === 'GET') {
      // Get specific bot details
      const { data: bot, error } = await supabase
        .from('bots')
        .select('id, bot_name, platform_type, personality_context, is_connected, created_at')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (error || !bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      const formattedBot = {
        id: bot.id,
        botName: bot.bot_name,
        platformType: bot.platform_type,
        personalityContext: bot.personality_context,
        isConnected: bot.is_connected,
        createdAt: bot.created_at
      };

      return res.status(200).json(formattedBot);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Bot API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred.'
    });
  }
} 