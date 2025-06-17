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

  const { action } = req.query;
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
    // Ensure user exists in database (auto-create if needed) for all requests
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

    if (req.method === 'GET' && !action) {
      // Get all bots for the user
      const { data: bots, error } = await supabase
        .from('bots')
        .select(`
          id,
          bot_name,
          platform_type,
          personality_context,
          is_connected,
          created_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBots = bots.map(bot => ({
        id: bot.id,
        botName: bot.bot_name,
        platformType: bot.platform_type,
        personalityContext: bot.personality_context,
        isConnected: bot.is_connected,
        createdAt: bot.created_at
      }));

      return res.status(200).json(formattedBots);
    }

    if (req.method === 'POST' && action === 'connect') {
      // Connect bot (start Discord client for Discord bots)
      const { botId } = req.body;
      
      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

      const { data: bot, error } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (error || !bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      // Update database connection status first
      const updatedBot = await supabase
        .from('bots')
        .update({ is_connected: true })
        .eq('id', botId)
        .eq('user_id', userId)
        .select()
        .single();

      if (updatedBot.error) {
        return res.status(500).json({ error: 'Failed to update bot connection status' });
      }

      // If it's a Discord bot, attempt to auto-start it
      if (bot.platform_type === 'discord' && bot.token) {
        try {
          // Attempt automatic startup using available methods
          const autoStartResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/discord-manager?action=auto-start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userId}`
            },
            body: JSON.stringify({ botId: bot.id })
          });

          if (autoStartResponse.ok) {
            const startupResult = await autoStartResponse.json();
            
            // If auto-start was successful
            if (startupResult.autoStarted) {
              console.log(`✅ Discord bot ${bot.bot_name} auto-started using ${startupResult.method}`);
              
              // Return success with auto-start info
              return res.json({
                ...updatedBot.data,
                autoStarted: true,
                startupMethod: startupResult.method,
                message: `Bot connected and automatically started using ${startupResult.method}!`
              });
            } else {
              // Auto-start failed, but provide client code for manual startup
              console.log(`⚠️ Discord bot ${bot.bot_name} connected but requires manual startup`);
              
              return res.json({
                ...updatedBot.data,
                autoStarted: false,
                requiresManualStart: true,
                clientCode: startupResult.clientCode,
                instructions: startupResult.instructions,
                message: startupResult.message || 'Bot connected! Please run the provided client code to start your Discord bot.'
              });
            }
          }
        } catch (autoStartError) {
          console.warn('Auto-start attempt failed:', autoStartError);
          // Continue with regular connection flow
        }
      }

      // Regular connection response (non-Discord or auto-start not available)
      res.json({
        ...updatedBot.data,
        message: 'Bot connected successfully!'
      });
    }

    if (req.method === 'POST' && action === 'disconnect') {
      // Disconnect bot (stop Discord client for Discord bots)
      const { botId } = req.body;
      
      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

      const { data: bot, error } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (error || !bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      // For Discord bots, you would stop the Discord client here
      // In serverless environment, we just update the database
      if (bot.platform_type === 'discord') {
        console.log(`Discord bot ${bot.bot_name} marked as disconnected`);
      }

      // Update database connection status
      const { data: updatedBot, error: updateError } = await supabase
        .from('bots')
        .update({ is_connected: false })
        .eq('id', botId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update bot status' });
      }

      // Create activity
      await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: 'bot_disconnected',
          description: `Bot ${bot.bot_name} was disconnected`,
          metadata: { botId: bot.id, platformType: bot.platform_type }
        });

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

    if (req.method === 'POST' && action === 'sync-commands') {
      // Sync Discord commands for a bot
      const { botId, forceRefresh = false } = req.body;
      
      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

      const { data: bot, error } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (error || !bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      if (bot.platform_type !== 'discord') {
        return res.status(400).json({ error: 'Command sync is only available for Discord bots' });
      }

      const result = await discoverAndSyncCommands(bot.token, botId, userId, forceRefresh);
      
      if (result.success && result.createdMappings > 0) {
        // Create activity for manual sync
        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: 'commands_synced',
            description: `Manually synced ${result.createdMappings} Discord commands for ${bot.bot_name}`,
            metadata: { 
              botId: bot.id, 
              commandsFound: result.discoveredCommands.length,
              commandsCreated: result.createdMappings,
              forceRefresh
            }
          });
      }

      return res.status(200).json(result);
    }

    if (req.method === 'POST' && action === 'cleanup-orphaned-mappings') {
      // Clean up orphaned command mappings (mappings without valid bots)
      
      try {
        // Find all mappings for this user
        const { data: allMappings, error: mappingsError } = await supabase
          .from('command_mappings')
          .select('id, bot_id, name')
          .eq('user_id', userId);

        if (mappingsError) {
          console.error('Error fetching mappings:', mappingsError);
          return res.status(500).json({ error: 'Failed to fetch mappings' });
        }

        if (!allMappings || allMappings.length === 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No orphaned mappings found',
            deletedCount: 0 
          });
        }

        // Get all bot IDs for this user
        const { data: userBots, error: botsError } = await supabase
          .from('bots')
          .select('id')
          .eq('user_id', userId);

        if (botsError) {
          console.error('Error fetching bots:', botsError);
          return res.status(500).json({ error: 'Failed to fetch bots' });
        }

        const validBotIds = new Set((userBots || []).map(bot => bot.id));

        // Find orphaned mappings (mappings pointing to non-existent bots)
        const orphanedMappings = allMappings.filter(mapping => !validBotIds.has(mapping.bot_id));

        if (orphanedMappings.length === 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No orphaned mappings found',
            deletedCount: 0 
          });
        }

        // Delete orphaned mappings
        const orphanedIds = orphanedMappings.map(m => m.id);
        const { error: deleteError } = await supabase
          .from('command_mappings')
          .delete()
          .in('id', orphanedIds)
          .eq('user_id', userId); // Double check user_id for security

        if (deleteError) {
          console.error('Error deleting orphaned mappings:', deleteError);
          return res.status(500).json({ error: 'Failed to delete orphaned mappings' });
        }

        // Create activity
        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: 'mappings_cleaned',
            description: `Cleaned up ${orphanedMappings.length} orphaned command mappings`,
            metadata: { 
              deletedCount: orphanedMappings.length,
              deletedMappings: orphanedMappings.map(m => ({ id: m.id, name: m.name, botId: m.bot_id }))
            }
          });

        return res.status(200).json({
          success: true,
          message: `Successfully deleted ${orphanedMappings.length} orphaned command mappings`,
          deletedCount: orphanedMappings.length,
          deletedMappings: orphanedMappings.map(m => m.name)
        });

      } catch (error) {
        console.error('Cleanup error:', error);
        return res.status(500).json({ 
          error: 'Internal server error during cleanup',
          message: error.message
        });
      }
    }

    if (req.method === 'POST' && !action) {
      // Create new bot
      const { botName, platformType, token, personalityContext } = req.body;
      
      if (!botName || !platformType || !token) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate Discord token if it's a Discord bot
      if (platformType === 'discord') {
        const tokenValidation = await validateDiscordToken(token);
        if (!tokenValidation.valid) {
          return res.status(400).json({ error: 'Invalid Discord bot token' });
        }
      }

      // Auto-generate personality context for Discord bots if none provided
      let finalPersonalityContext = personalityContext;
      if (platformType === 'discord' && !personalityContext) {
        finalPersonalityContext = `You are ${botName}, a helpful Discord moderation bot. You can understand natural language commands and execute Discord moderation actions like banning, kicking, warning users, and managing messages. Always be professional and helpful.`;
      }

      const { data: newBot, error } = await supabase
        .from('bots')
        .insert({
          user_id: userId,
          bot_name: botName,
          platform_type: platformType,
          token: token,
          personality_context: finalPersonalityContext,
          is_connected: false
        })
        .select('*')
        .single();

      if (error) throw error;

      // Auto-discover commands for Discord bots
      if (platformType === 'discord') {
        try {
          await discoverAndSyncCommands(token, newBot.id, userId, false);
        } catch (discoveryError) {
          console.error('Command discovery failed during bot creation:', discoveryError);
          // Don't fail bot creation if discovery fails
        }
      }

      // Create activity
      await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: 'bot_created',
          description: `Created new ${platformType} bot: ${botName}`,
          metadata: { botId: newBot.id, platformType }
        });

      const formattedBot = {
        id: newBot.id,
        botName: newBot.bot_name,
        platformType: newBot.platform_type,
        personalityContext: newBot.personality_context,
        isConnected: newBot.is_connected,
        createdAt: newBot.created_at
      };

      return res.status(201).json(formattedBot);
    }

    if (req.method === 'PUT') {
      // Update bot connection status or handle actions
      const { id, action, botId, isConnected } = req.body;
      const actualBotId = botId || id; // Support both formats
      
      if (!actualBotId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

      // Handle specific actions
      if (action === 'connect') {
        const { data: bot, error } = await supabase
          .from('bots')
          .select('*')
          .eq('id', actualBotId)
          .eq('user_id', userId)
          .single();

        if (error || !bot) {
          return res.status(404).json({ error: 'Bot not found' });
        }

        // Update database connection status first
        const { data: updatedBot, error: updateError } = await supabase
          .from('bots')
          .update({ is_connected: true })
          .eq('id', actualBotId)
          .eq('user_id', userId)
          .select('*')
          .single();

        if (updateError) {
          return res.status(500).json({ error: 'Failed to update bot status' });
        }

        // For Discord bots, validate token (in production, you'd start actual Discord client)
        if (bot.platform_type === 'discord' && bot.token) {
          try {
            // Validate the Discord token
            const validation = await validateDiscordToken(bot.token);
            
            if (!validation.valid) {
              // Revert database status
              await supabase
                .from('bots')
                .update({ is_connected: false })
                .eq('id', actualBotId)
                .eq('user_id', userId);
                
              return res.status(400).json({ 
                message: "Invalid Discord bot token. Please check your token in the Discord Developer Portal.",
                error: "INVALID_DISCORD_TOKEN",
                troubleshooting: [
                  "Verify token is copied correctly from Discord Developer Portal",
                  "Ensure bot has 'bot' and 'applications.commands' scopes",
                  "Check if token was recently regenerated",
                  "Confirm bot is not deleted or disabled"
                ]
              });
            }

            // In a real implementation, you would start the Discord client here
            // For serverless environment, we just validate and mark as connected
            console.log(`Discord bot ${bot.bot_name} validated and marked as connected`);
            
          } catch (error) {
            // Revert database status if validation failed
            await supabase
              .from('bots')
              .update({ is_connected: false })
              .eq('id', actualBotId)
              .eq('user_id', userId);
            
            const errorMessage = error.message;
            let specificMessage = "Error connecting Discord bot";
            let troubleshooting = [
              "Check Discord bot token",
              "Verify bot permissions",
              "Ensure bot is not disabled"
            ];
            
            // Provide specific error messages
            if (errorMessage.includes("Incorrect login details") || errorMessage.includes("Invalid")) {
              specificMessage = "Invalid Discord bot token provided";
              troubleshooting = [
                "Copy token exactly from Discord Developer Portal > Bot section",
                "Don't include 'Bot ' prefix when copying",
                "Regenerate token if it's not working"
              ];
            } else if (errorMessage.includes("Too many requests") || errorMessage.includes("rate limit")) {
              specificMessage = "Discord API rate limit exceeded";
              troubleshooting = [
                "Wait a few minutes before trying again",
                "Check if bot is being used elsewhere",
                "Ensure only one instance is running"
              ];
            } else if (errorMessage.includes("Missing Permissions") || errorMessage.includes("permissions")) {
              specificMessage = "Bot token lacks required permissions";
              troubleshooting = [
                "Add 'bot' scope in Discord Developer Portal",
                "Add 'applications.commands' scope if using slash commands",
                "Reinvite bot to server with correct permissions"
              ];
            }
            
            return res.status(500).json({ 
              message: specificMessage,
              error: "DISCORD_CONNECTION_ERROR",
              details: errorMessage,
              troubleshooting
            });
          }
        }

        // Create activity
        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: 'bot_connected',
            description: `Bot ${bot.bot_name} was connected`,
            metadata: { botId: bot.id, platformType: bot.platform_type }
          });

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

      if (action === 'disconnect') {
        const { data: bot, error } = await supabase
          .from('bots')
          .select('*')
          .eq('id', actualBotId)
          .eq('user_id', userId)
          .single();

        if (error || !bot) {
          return res.status(404).json({ error: 'Bot not found' });
        }

        // For Discord bots, you would stop the Discord client here
        // In serverless environment, we just update the database
        if (bot.platform_type === 'discord') {
          console.log(`Discord bot ${bot.bot_name} marked as disconnected`);
        }

        // Update database connection status
        const { data: updatedBot, error: updateError } = await supabase
          .from('bots')
          .update({ is_connected: false })
          .eq('id', actualBotId)
          .eq('user_id', userId)
          .select('*')
          .single();

        if (updateError) {
          return res.status(500).json({ error: 'Failed to update bot status' });
        }

        // Create activity
        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: 'bot_disconnected',
            description: `Bot ${bot.bot_name} was disconnected`,
            metadata: { botId: bot.id, platformType: bot.platform_type }
          });

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

      if (action === 'sync-commands') {
        // Handle command sync
        const { forceRefresh = false } = req.body;

        const { data: bot, error } = await supabase
          .from('bots')
          .select('*')
          .eq('id', actualBotId)
          .eq('user_id', userId)
          .single();

        if (error || !bot) {
          return res.status(404).json({ error: 'Bot not found' });
        }

        if (bot.platform_type !== 'discord') {
          return res.status(400).json({ error: 'Command sync is only available for Discord bots' });
        }

        const result = await discoverAndSyncCommands(bot.token, actualBotId, userId, forceRefresh);
        
        if (result.success && result.createdMappings > 0) {
          // Create activity for manual sync
          await supabase
            .from('activities')
            .insert({
              user_id: userId,
              activity_type: 'commands_synced',
              description: `Manually synced ${result.createdMappings} Discord commands for ${bot.bot_name}`,
              metadata: { 
                botId: bot.id, 
                commandsFound: result.discoveredCommands.length,
                commandsCreated: result.createdMappings,
                forceRefresh
              }
            });
        }

        return res.status(200).json(result);
      }

      // Legacy support for simple isConnected update
      if (isConnected !== undefined && !action) {
        const { data: updatedBot, error } = await supabase
          .from('bots')
          .update({ 
            is_connected: isConnected
          })
          .eq('id', actualBotId)
          .eq('user_id', userId)
          .select('*')
          .single();

        if (error) throw error;

        // Create activity
        const activityType = isConnected ? 'bot_connected' : 'bot_disconnected';
        const description = isConnected 
          ? `Bot ${updatedBot.bot_name} was connected`
          : `Bot ${updatedBot.bot_name} was disconnected`;

        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: activityType,
            description: description,
            metadata: { botId: updatedBot.id, platformType: updatedBot.platform_type }
          });

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

      return res.status(400).json({ error: 'Invalid action or missing parameters' });
    }

    if (req.method === 'DELETE') {
      // Delete bot
      const { botId } = req.query;
      
      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

      const { data: bot, error: fetchError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      // Delete associated command mappings first (cascade delete)
      const { error: mappingsError } = await supabase
        .from('command_mappings')
        .delete()
        .eq('bot_id', botId)
        .eq('user_id', userId); // Also filter by user_id for security

      if (mappingsError) {
        console.error('Error deleting command mappings:', mappingsError);
        // Continue with bot deletion even if mappings deletion fails
      }

      // Delete the bot
      const { error } = await supabase
        .from('bots')
        .delete()
        .eq('id', botId)
        .eq('user_id', userId);

      if (error) throw error;

      // Create activity
      await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: 'bot_deleted',
          description: `Deleted bot: ${bot.bot_name} (${bot.platform_type})`,
          metadata: { 
            botId: bot.id, 
            platformType: bot.platform_type,
            botName: bot.bot_name,
            deletedMappings: !mappingsError
          }
        });

      return res.status(200).json({ 
        success: true, 
        message: `Bot "${bot.bot_name}" and all associated command mappings have been deleted successfully` 
      });
    }

    return res.status(400).json({ error: 'Invalid request method or action' });

  } catch (error) {
    console.error('Bots API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}

// DISCORD COMMAND DISCOVERY SYSTEM (migrated from server)
async function discoverAndSyncCommands(botToken: string, botId: string, userId: string, forceRefresh: boolean = false) {
  try {
    // Fetch application commands from Discord API
    const response = await fetch('https://discord.com/api/v10/applications/@me/commands', {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }

    const commands = await response.json();
    
    if (!Array.isArray(commands)) {
      return {
        success: false,
        error: 'Invalid response from Discord API',
        discoveredCommands: [],
        createdMappings: 0
      };
    }

    // If forceRefresh, delete existing mappings
    if (forceRefresh) {
      await supabase
        .from('command_mappings')
        .delete()
        .eq('bot_id', botId)
        .eq('user_id', userId);
    }

    let createdMappings = 0;
    const discoveredCommands: any[] = [];

    for (const command of commands) {
      // Check if mapping already exists
      const { data: existingMapping } = await supabase
        .from('command_mappings')
        .select('id')
        .eq('bot_id', botId)
        .eq('user_id', userId)
        .eq('discord_command_id', command.id)
        .single();

      if (existingMapping && !forceRefresh) {
        continue; // Skip if already exists and not force refreshing
      }

      // Generate natural language patterns and command output
      const patterns = generateNaturalLanguagePatterns(command);
      const commandOutput = generateCommandOutput(command);

      // Create command mapping
      const { error } = await supabase
        .from('command_mappings')
        .insert({
          user_id: userId,
          bot_id: botId,
          name: command.name,
          natural_language_pattern: patterns.primary,
          command_output: commandOutput,
          discord_command_id: command.id,
          description: command.description || `Discord command: ${command.name}`,
          status: 'active'
        });

      if (!error) {
        createdMappings++;
      }

      discoveredCommands.push({
        id: command.id,
        name: command.name,
        description: command.description,
        options: command.options || [],
        patterns: patterns,
        commandOutput: commandOutput
      });
    }

    return {
      success: true,
      discoveredCommands,
      createdMappings,
      totalCommands: commands.length
    };

  } catch (error) {
    console.error('Command discovery error:', error);
    return {
      success: false,
      error: error.message,
      discoveredCommands: [],
      createdMappings: 0
    };
  }
}

// PATTERN GENERATION (migrated from server)
function generateNaturalLanguagePatterns(command: any) {
  const commandName = command.name;
  const options = command.options || [];
  
  // Generate primary pattern based on command structure
  let primaryPattern = commandName;
  const alternativePatterns: string[] = [];

  // Add parameters to pattern
  for (const option of options) {
    if (option.required) {
      primaryPattern += ` {${option.name}}`;
    }
  }

  // Generate semantic alternatives based on command name and description
  const semanticAlternatives = generateSemanticPatterns(commandName, options, command.description);
  alternativePatterns.push(...semanticAlternatives);

  // Generate contextual patterns based on command type
  const contextualPatterns = generateContextualPatterns(commandName, options);
  alternativePatterns.push(...contextualPatterns);

  return {
    primary: primaryPattern,
    alternatives: alternativePatterns
  };
}

function generateSemanticPatterns(commandName: string, options: any[], description?: string): string[] {
  const patterns: string[] = [];
  
  // Enhanced semantic mapping with more natural language variations
  const semanticMap: Record<string, string[]> = {
    'ban': [
      'ban {user} for {reason}',
      'remove {user} permanently for {reason}',
      'banish {user}',
      'kick out {user} forever',
      'permanently remove {user}',
      'get rid of {user}',
      '{user} needs to be banned for {reason}',
      'please ban {user} they are {reason}'
    ],
    'kick': [
      'kick {user}',
      'remove {user}',
      'boot {user}',
      'eject {user}',
      'throw out {user}',
      '{user} should be kicked for {reason}',
      'please remove {user} from the server'
    ],
    'warn': [
      'warn {user} for {reason}',
      'warning {user}',
      'caution {user}',
      'notify {user}',
      'give {user} a warning',
      '{user} deserves a warning for {reason}',
      'please warn {user} about {reason}'
    ],
    'mute': [
      'mute {user}',
      'silence {user}',
      'quiet {user}',
      'shut up {user}',
      '{user} needs to be muted',
      'please mute {user} for {reason}'
    ],
    'timeout': [
      'timeout {user} for {duration}',
      'temp ban {user}',
      'temporarily ban {user}',
      'time out {user}',
      'put {user} in timeout',
      '{user} needs a timeout for {duration}'
    ],
    'purge': [
      'purge {amount} messages',
      'delete {amount} messages',
      'clear {amount} messages',
      'remove last {amount} messages',
      'clean up {amount} messages',
      'delete the last {amount} messages',
      'clear chat {amount}'
    ],
    'role': [
      'give {user} {role} role',
      'add {role} to {user}',
      'assign {role} role to {user}',
      'make {user} a {role}',
      '{user} should get {role} role'
    ],
    'slowmode': [
      'set slowmode to {seconds} seconds',
      'enable slowmode {seconds}',
      'add slowmode {seconds}',
      'turn on slowmode',
      'slow down the chat'
    ],
    'pin': [
      'pin this message',
      'pin that',
      'please pin this',
      'this should be pinned'
    ],
    'unpin': [
      'unpin this message',
      'unpin that',
      'remove pin'
    ],
    'say': [
      'say {message}',
      'announce {message}',
      'tell everyone {message}',
      'broadcast {message}',
      'send message {message}'
    ],
    'note': [
      'note {message}',
      'add note {message}',
      'record {message}',
      'log {message}'
    ]
  };

  // Add command-specific patterns
  if (semanticMap[commandName]) {
    patterns.push(...semanticMap[commandName]);
  }

  // Generate patterns from description if available
  if (description && description.length > 0) {
    const descriptionPattern = description.toLowerCase().replace(/[^\w\s]/g, '');
    patterns.push(descriptionPattern);
    
    // Add variations with parameters
    if (options.length > 0) {
      const paramNames = options.filter(opt => opt.required).map(opt => `{${opt.name}}`);
      if (paramNames.length > 0) {
        patterns.push(`${descriptionPattern} ${paramNames.join(' ')}`);
      }
    }
  }

  // Generate patterns based on option names
  if (options.length > 0) {
    const paramPattern = options
      .filter(opt => opt.required)
      .map(opt => `{${opt.name}}`)
      .join(' ');
    
    if (paramPattern) {
      patterns.push(`${commandName} ${paramPattern}`);
      
      // Add natural variations
      if (commandName === 'ban' && paramPattern.includes('user') && paramPattern.includes('reason')) {
        patterns.push('ban the user {user} for {reason}');
        patterns.push('please ban {user} because {reason}');
      }
    }
  }

  return patterns;
}

function generateContextualPatterns(commandName: string, options: any[]): string[] {
  const patterns: string[] = [];
  
  // Generate patterns based on common Discord use cases
  const contextualMap: Record<string, string[]> = {
    'ban': [
      'this user is spamming',
      'they keep breaking rules',
      'get this troll out of here',
      'this person is being toxic'
    ],
    'kick': [
      'this user is being disruptive',
      'they need to cool down',
      'remove this troublemaker'
    ],
    'warn': [
      'this behavior is not okay',
      'they need to stop this',
      'please follow the rules'
    ],
    'mute': [
      'they are being too loud',
      'silence this spam',
      'they need to stop talking'
    ],
    'purge': [
      'clean up this mess',
      'delete all this spam',
      'clear the chat'
    ]
  };

  if (contextualMap[commandName]) {
    patterns.push(...contextualMap[commandName]);
  }

  return patterns;
}

function generateCommandOutput(command: any): string {
  const commandName = command.name;
  const options = command.options || [];
  
  let output = `/${commandName}`;
  
  for (const option of options) {
    output += ` {${option.name}}`;
  }
  
  return output;
}

// DISCORD TOKEN VALIDATION (migrated from server)
async function validateDiscordToken(token: string) {
  try {
    const cleanToken = token.trim().replace(/^Bot\s+/i, '');
    
    // Allow test tokens in development
    if (cleanToken === 'test-token' || cleanToken.startsWith('test-')) {
      return {
        valid: true,
        applicationId: 'test-app-id',
        botName: 'Test Bot',
        botInfo: {
          id: 'test-app-id',
          name: 'Test Bot',
          description: 'Test bot for development',
          avatar: null
        }
      };
    }
    
    const response = await fetch('https://discord.com/api/v10/applications/@me', {
      headers: {
        'Authorization': `Bot ${cleanToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { valid: false, error: 'Invalid token' };
    }

    const application = await response.json();
    
    return {
      valid: true,
      applicationId: application.id,
      botName: application.name,
      botInfo: {
        id: application.id,
        name: application.name,
        description: application.description,
        avatar: application.icon ? `https://cdn.discordapp.com/app-icons/${application.id}/${application.icon}.png` : null
      }
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// DISCORD CLIENT CODE GENERATION (migrated from server)
function generateDiscordClientCode(bot: any): string {
  return `const { Client, GatewayIntentBits, Events } = require('discord.js');
const fetch = require('node-fetch');

// Bot Configuration
const BOT_TOKEN = '${bot.token}';
const BOT_ID = '${bot.id}';
const BOT_NAME = '${bot.bot_name}';
const COMMANDLESS_API_URL = 'https://commandlessapp-nft6hub5t-abdarrahmans-projects.vercel.app';

console.log('🤖 Starting \${BOT_NAME}...');
console.log('🔗 Commandless API:', COMMANDLESS_API_URL);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(\`✅ \${BOT_NAME} is ready! Logged in as \${readyClient.user.tag}\`);
  console.log(\`🤖 Bot ID: \${readyClient.user.id}\`);
  console.log(\`🧠 AI Personality: ${bot.personality_context || 'Default Discord bot personality'}\`);
});

// Message handling
client.on(Events.MessageCreate, async (message) => {
  try {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if bot is mentioned or replied to
    const botMentioned = message.mentions.users.has(client.user.id);
    const isReplyToBot = message.reference && 
      message.reference.messageId && 
      (await message.channel.messages.fetch(message.reference.messageId))?.author.id === client.user.id;

    if (!botMentioned && !isReplyToBot) return;

    console.log(\`📨 Processing: "\${message.content}" from \${message.author.username}\`);

    // Prepare message data for Commandless AI
    const messageData = {
      message: {
        content: message.content,
        author: {
          id: message.author.id,
          username: message.author.username,
          bot: message.author.bot
        },
        channel_id: message.channel.id,
        guild_id: message.guild?.id,
        mentions: message.mentions.users.map(user => ({
          id: user.id,
          username: user.username
        })),
        referenced_message: message.reference ? {
          id: message.reference.messageId,
          author: { id: client.user.id }
        } : undefined
      },
      botToken: BOT_TOKEN,
      botClientId: client.user.id
    };

    // Send to Commandless AI API
    const response = await fetch(\`\${COMMANDLESS_API_URL}/api/discord?action=process-message\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    const result = await response.json();

    if (result.processed && result.response) {
      console.log(\`🤖 AI Response: \${result.response}\`);
      await message.reply(result.response);

      if (result.execution) {
        console.log(\`⚡ Command: \${result.execution.success ? 'Success' : 'Failed'}\`);
        if (result.execution.error) {
          console.log(\`❌ Error: \${result.execution.error}\`);
        }
      }
    } else {
      console.log(\`⏭️ Not processed: \${result.reason || 'Unknown reason'}\`);
    }

  } catch (error) {
    console.error('❌ Error processing message:', error);
    try {
      await message.reply('Sorry, I encountered an error. Please try again.');
    } catch (replyError) {
      console.error('❌ Failed to send error reply:', replyError);
    }
  }
});

// Error handling
client.on(Events.Error, (error) => {
  console.error('❌ Discord client error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down \${BOT_NAME}...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down \${BOT_NAME}...');
  client.destroy();
  process.exit(0);
});

// Start the bot
client.login(BOT_TOKEN).catch(error => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});`;
} 