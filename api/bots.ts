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

export default async function handler(req: any, res: any) {
  console.log('=== BOTS API REQUEST START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', JSON.stringify(req.query));
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));
  console.log('=== BOTS API REQUEST DATA ===');

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;
  const bodyAction = req.body?.action;
  const finalAction = action || bodyAction;
  
  // Authentication
  const authHeader = req.headers.authorization;
  console.log('Auth header present:', !!authHeader);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No auth header or invalid format');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Token extracted:', token.substring(0, 20) + '...');
  
  const decodedToken = decodeJWT(token);
  console.log('Decoded token:', !!decodedToken);
  
  if (!decodedToken) {
    console.log('Token decode failed');
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = decodedToken.userId;
  console.log('User ID extracted:', userId);

  console.log('=== AUTHENTICATION COMPLETE ===');
  
  try {
    // Ensure user exists in database
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

    if (req.method === 'GET' && !finalAction) {
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

    if (req.method === 'POST' && !finalAction) {
      // Create new bot
      const { botName, platformType, token, personalityContext } = req.body;
      
      if (!botName || !platformType || !token) {
        return res.status(400).json({ 
          error: 'Missing required fields', 
          details: {
            botName: !!botName,
            platformType: !!platformType,
            token: !!token
          }
        });
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
  
    // Simple debug before conditions
    console.log('METHOD:', req.method);
    console.log('QUERY_EXISTS:', !!req.query);
    console.log('BOTID_EXISTS:', !!(req.query && req.query.botId));
  
  if (req.method === 'PUT' && req.query && req.query.botId) {
    console.log('ENTERING PUT LOGIC');
    
    // Extract botId safely
    let botId;
    try {
      botId = Array.isArray(req.query.botId) ? req.query.botId[0] : req.query.botId;
      console.log('EXTRACTED_BOTID:', botId);
    } catch (e) {
      console.log('BOTID_EXTRACTION_ERROR:', e.message);
      return res.status(400).json({ error: 'Invalid botId parameter' });
    }

    if (!botId) {
      console.log('BOTID_EMPTY_AFTER_EXTRACTION');
      return res.status(400).json({ error: 'Bot ID is required' });
    }

    console.log('PROCEEDING_WITH_UPDATE');
    
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

    if (req.method === 'DELETE' && req.query && req.query.botId) {
      // Delete individual bot
      let { botId } = req.query;
      
      // Handle case where query param might be an array
      if (Array.isArray(botId)) {
        botId = botId[0];
      }
      
      console.log('DELETE request with botId:', botId);

      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

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

    // Handle body-based actions (connect, disconnect, sync-commands)
    if (req.method === 'PUT' && finalAction) {
      const { botId } = req.body;
      
      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required for this action' });
      }

      // Get bot to verify ownership
      const { data: bot, error: fetchError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      if (finalAction === 'connect') {
        // Connect bot - this is a simplified version that just updates the database
        // In a full implementation, this would also start the bot service
        const { error: updateError } = await supabase
          .from('bots')
          .update({ is_connected: true })
          .eq('id', botId)
          .eq('user_id', userId);

        if (updateError) {
          return res.status(500).json({ 
            error: 'Failed to connect bot',
            message: 'There was an error connecting your bot. Please try again.'
          });
        }

        // Create activity log
        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: 'bot_connected',
            description: `Bot "${bot.bot_name}" was connected`,
            metadata: { botId: bot.id }
          });

        return res.status(200).json({
          success: true,
          autoStarted: true,
          message: `${bot.bot_name} has been connected successfully.`
        });
      }

      if (finalAction === 'disconnect') {
        // Disconnect bot
        const { error: updateError } = await supabase
          .from('bots')
          .update({ is_connected: false })
          .eq('id', botId)
          .eq('user_id', userId);

        if (updateError) {
          return res.status(500).json({ 
            error: 'Failed to disconnect bot',
            message: 'There was an error disconnecting your bot. Please try again.'
          });
        }

        // Create activity log
        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: 'bot_disconnected',
            description: `Bot "${bot.bot_name}" was disconnected`,
            metadata: { botId: bot.id }
          });

        return res.status(200).json({
          success: true,
          message: `${bot.bot_name} has been disconnected successfully.`
        });
      }

      if (finalAction === 'sync-commands') {
        // Sync Discord commands
        if (bot.platform_type === 'discord') {
          const { forceRefresh = false } = req.body;
          
          try {
            const syncResult = await discoverAndSyncCommands(bot.token, bot.id, userId, forceRefresh);
            
            if (syncResult.success && syncResult.discoveredCommands && syncResult.discoveredCommands.length > 0) {
              // Generate AI examples for the synced commands
              try {
                console.log('🎯 Generating AI examples for synced commands...');
                const aiExamples = await generateAIExamples(syncResult.discoveredCommands);
                
                // Cache the AI examples in the bot record
                const { error: updateError } = await supabase
                  .from('bots')
                  .update({ ai_examples: aiExamples })
                  .eq('id', bot.id)
                  .eq('user_id', userId);
                
                if (updateError) {
                  console.error('❌ Failed to cache AI examples:', updateError);
                  // Don't fail the sync if AI examples fail - it's not critical
                } else {
                  console.log('✅ AI examples generated and cached successfully');
                }
              } catch (aiError) {
                console.error('❌ AI example generation failed:', aiError);
                // Don't fail the sync if AI examples fail
              }
              
              return res.status(200).json({
                success: true,
                message: syncResult.message,
                commandCount: syncResult.commandCount,
                createdMappings: syncResult.createdMappings,
                discoveredCommands: syncResult.discoveredCommands,
                aiExamplesGenerated: true
              });
            } else if (syncResult.success) {
              return res.status(200).json({
                success: true,
                message: syncResult.message,
                commandCount: syncResult.commandCount,
                createdMappings: syncResult.createdMappings,
                discoveredCommands: syncResult.discoveredCommands
              });
            } else {
              return res.status(500).json({
                error: 'Command sync failed',
                message: syncResult.message
              });
            }
          } catch (error) {
            return res.status(500).json({
              error: 'Command sync failed',
              message: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        } else {
          return res.status(400).json({ 
            error: 'Command sync only available for Discord bots'
          });
        }
      }

      return res.status(400).json({ error: `Unknown action: ${finalAction}` });
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

// AI Example Generation Function
async function generateAIExamples(commands: any[]): Promise<string> {
  try {
    console.log('🎯 Generating AI examples for', commands.length, 'commands');
    
    const commandList = commands.map(cmd => 
      `- ${cmd.name}: ${cmd.description || 'Discord command'}`
    ).join('\n');
    
    const prompt = `Generate natural language examples for these Discord bot commands. Each command should have 2-3 natural phrases that users might say to trigger it.

Commands:
${commandList}

Format: "natural phrase → COMMAND_NAME"
Examples:
- "ban john from the server" → BAN
- "remove this user" → BAN  
- "kick him out" → KICK
- "warn about spam" → WARN
- "give warning to user" → WARN

Generate examples for ALL commands above. Be creative with natural language variations:`;

    // Use fetch to call Gemini API directly (since we're in Vercel environment)
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=' + process.env.GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const examples = data.candidates[0].content.parts[0].text;
    
    console.log('✅ Generated AI examples:', examples.substring(0, 200) + '...');
    return examples;
    
  } catch (error) {
    console.error('❌ Error generating AI examples:', error);
    // Return fallback examples if AI fails
    return commands.map(cmd => 
      `"execute ${cmd.name}" → ${cmd.name.toUpperCase()}`
    ).join('\n');
  }
}

// DISCORD COMMAND DISCOVERY SYSTEM (migrated from server)
async function discoverAndSyncCommands(botToken: string, botId: string, userId: string, forceRefresh: boolean = false) {
  try {
    console.log(`🔍 Starting command discovery for bot ${botId}`);
    console.log(`🔑 Token length: ${botToken?.length}, Force refresh: ${forceRefresh}`);
    
    // Get application info to determine if we have the right permissions
    const appResponse = await fetch('https://discord.com/api/v10/applications/@me', {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📋 Application info response status: ${appResponse.status}`);
    
    if (!appResponse.ok) {
      const appError = await appResponse.text();
      console.error(`❌ Failed to get application info: ${appResponse.status} - ${appError}`);
      throw new Error(`Failed to get application info: ${appResponse.status} - ${appError}`);
    }

    const appData = await appResponse.json();
    console.log(`✅ Application info retrieved: ${appData.name} (ID: ${appData.id})`);

    // Check if we already have commands for this bot (unless forcing refresh)
    if (!forceRefresh) {
      const { data: existingMappings } = await supabase!
        .from('command_mappings')
        .select('id')
        .eq('bot_id', botId)
        .limit(1);

      if (existingMappings && existingMappings.length > 0) {
        console.log('✅ Commands already exist for bot, skipping discovery');
        return { 
          success: true, 
          message: 'Commands already synced', 
          commandCount: existingMappings.length,
          discoveredCommands: [],
          createdMappings: 0
        };
      }
    }

    // Get global application commands with detailed debugging
    console.log(`🌍 Fetching GLOBAL application commands...`);
    console.log(`🔗 Discord API URL: https://discord.com/api/v10/applications/${appData.id}/commands`);
    console.log(`🔑 Authorization header: Bot ${botToken.substring(0, 20)}...`);
    
    const commandsResponse = await fetch(`https://discord.com/api/v10/applications/${appData.id}/commands`, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📋 Global commands response status: ${commandsResponse.status}`);
    console.log(`📋 Response headers:`, Object.fromEntries(commandsResponse.headers.entries()));
    
    if (!commandsResponse.ok) {
      const commandsError = await commandsResponse.text();
      console.error(`❌ Failed to fetch global commands: ${commandsResponse.status} - ${commandsError}`);
      
      // Log the full error for debugging
      console.error(`🔍 Full error details:`);
      console.error(`   Status: ${commandsResponse.status}`);
      console.error(`   Status Text: ${commandsResponse.statusText}`);
      console.error(`   Error Body: ${commandsError}`);
      
      throw new Error(`Failed to fetch commands: ${commandsResponse.status} - ${commandsError}`);
    }

    const rawResponse = await commandsResponse.text();
    console.log(`📄 Raw response body: ${rawResponse.substring(0, 500)}${rawResponse.length > 500 ? '...' : ''}`);
    
    let globalCommands;
    try {
      globalCommands = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error(`❌ Failed to parse commands response as JSON:`, parseError);
      console.error(`📄 Raw response that failed to parse: ${rawResponse}`);
      throw new Error(`Invalid JSON response from Discord API: ${parseError.message}`);
    }
    
    console.log(`🌍 Global commands found: ${globalCommands.length}`);
    console.log(`📊 Commands response type: ${Array.isArray(globalCommands) ? 'Array' : typeof globalCommands}`);
    
    if (globalCommands.length > 0) {
      console.log(`📋 Global command names: ${globalCommands.map(cmd => cmd.name).join(', ')}`);
      console.log(`🔧 First command details:`, JSON.stringify(globalCommands[0], null, 2));
    } else {
      console.log(`⚠️ NO GLOBAL COMMANDS FOUND!`);
      console.log(`📋 This means either:`);
      console.log(`   • Commands are not registered globally (only in specific servers)`);
      console.log(`   • Bot token doesn't have applications.commands scope`);
      console.log(`   • Commands were deleted or not properly registered`);
      console.log(`   • There's a Discord API issue`);
      
      // Let's also check if we can access application info at all
      console.log(`🔍 Double-checking application access...`);
      console.log(`✅ Application info worked earlier: ${appData.name} (${appData.id})`);
      console.log(`📊 Bot has required scopes to access application info`);
    }

    const commands = globalCommands;
    console.log(`🔍 Using global commands. Total discovered: ${commands.length}`);

    if (commands.length === 0) {
      console.log(`⚠️ NO COMMANDS FOUND after comprehensive search!`);
      console.log(`📋 Search summary:`);
      console.log(`   • Global commands: ${globalCommands.length}`);
      console.log(`📋 Possible issues:`);
      console.log(`   • Bot token doesn't have applications.commands scope`);
      console.log(`   • Commands haven't been registered yet`);
      console.log(`   • Bot lacks permissions to view commands`);
      console.log(`   • Commands are registered to specific guilds instead of globally`);
      
      return { 
        success: true, 
        message: 'No slash commands found - may be guild-specific or missing scope', 
        commandCount: 0,
        discoveredCommands: [],
        createdMappings: 0,
        debugInfo: {
          globalCommands: globalCommands.length,
          applicationId: appData.id,
          botName: appData.name
        }
      };
    }

    // Create command mappings for each discovered command (reference data for AI)
    const commandMappings: any[] = [];
    
    for (const command of commands) {
      console.log(`🔧 Processing command: ${command.name} (ID: ${command.id})`);
      console.log(`   Description: ${command.description}`);
      console.log(`   Options: ${command.options?.length || 0}`);
      
      // Store the actual Discord command structure for AI reference
      const commandOutput = generateCommandOutput(command);
      
      // Store each command ONCE as reference data for AI processing
      commandMappings.push({
        bot_id: botId,
        user_id: userId,
        name: command.name,
        natural_language_pattern: command.description || `Discord slash command: /${command.name}`,
        command_output: commandOutput,
        status: 'active'
      });
    }

    console.log(`📝 Created ${commandMappings.length} command mappings from ${commands.length} commands`);

    // Insert all command mappings with conflict handling
    const { data: insertedMappings, error: insertError } = await supabase!
      .from('command_mappings')
      .upsert(commandMappings, { 
        onConflict: 'user_id,bot_id,name',
        ignoreDuplicates: true 
      })
      .select();

    if (insertError) {
      console.error('❌ Error inserting command mappings:', insertError);
      throw insertError;
    }

    console.log(`✅ Upsert operation completed. Returned records: ${insertedMappings?.length || 0}`);

    // Get the actual total count of command mappings for this bot (since upsert might return 0 for existing records)
    const { data: totalMappings, error: countError } = await supabase!
      .from('command_mappings')
      .select('id')
      .eq('bot_id', botId)
      .eq('user_id', userId);

    if (countError) {
      console.error('❌ Error counting command mappings:', countError);
      throw countError;
    }

    const actualMappingCount = totalMappings?.length || 0;
    console.log(`📊 Total command mappings for bot: ${actualMappingCount}`);

    // Log the sync activity
    await supabase!
      .from('activities')
      .insert({
        user_id: userId,
        activity_type: 'commands_synced',
        description: `Automatically synced ${commands.length} Discord commands`,
        metadata: { 
          botId,
          commandCount: commands.length,
          patternCount: actualMappingCount,
          forceRefresh,
          debugInfo: {
            globalCommands: globalCommands.length,
            applicationId: appData.id,
            botName: appData.name,
            upsertReturned: insertedMappings?.length || 0
          }
        }
      });

    return { 
      success: true, 
      message: `Successfully synced ${commands.length} commands with ${actualMappingCount} patterns`,
      commandCount: commands.length,
      patternCount: actualMappingCount,
      discoveredCommands: commands,
      createdMappings: actualMappingCount,
      debugInfo: {
        globalCommands: globalCommands.length,
        applicationId: appData.id,
        botName: appData.name,
        totalMappings: actualMappingCount,
        upsertReturned: insertedMappings?.length || 0
      }
    };

  } catch (error) {
    console.error('❌ Command discovery error:', error);
    return { 
      success: false, 
      message: `Failed to sync commands: ${(error as Error).message}`,
      error: (error as Error).message,
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
      'kick out {user}',
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
  const commandName = command.name.toLowerCase();
  const options = command.options || [];
  
  // Generate executable command patterns instead of templates
  // The URS will handle parameter injection based on context
  
  // For simple commands without required parameters
  if (options.length === 0 || options.every(opt => !opt.required)) {
    return commandName.toUpperCase();
  }
  
  // For commands with parameters, return the command identifier
  // The URS will handle building the actual slash command with parameters
  return commandName.toUpperCase();
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
  const COMMANDLESS_API_URL = 'https://commandless.app';
  return `const { Client, GatewayIntentBits, Events } = require('discord.js');
const fetch = require('node-fetch');

// Bot Configuration
const BOT_TOKEN = '${bot.token}';
const BOT_ID = '${bot.id}';
const BOT_NAME = '${bot.bot_name}';

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