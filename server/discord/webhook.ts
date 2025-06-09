import { Request, Response } from 'express';
import { verifyDiscordSignature } from './verifySignature';
import { storage } from '../storage';
import { log } from '../vite';
import { processDiscordMessageWithAI } from './messageHandlerAI';
import { processDiscordMessage } from './messageHandler';
import { 
  getConversation, 
  updateConversation, 
  endConversation,
  isAffirmativeResponse,
  isNegativeResponse
} from './conversationManager';

// Use AI intent processing if enabled
const useAIProcessing = process.env.USE_AI_INTENT_PROCESSING === 'true';

/**
 * Process a Discord webhook request
 * 
 * This handler does the following:
 * 1. Verifies the Discord signature (if enabled)
 * 2. Processes incoming messages
 * 3. Matches messages against command patterns
 * 4. Executes matched commands
 */
export async function discordWebhookHandler(req: Request, res: Response) {
  try {
    // Verify the signature if verification is enabled and PUBLIC_KEY is provided
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    if (publicKey && process.env.VERIFY_DISCORD_SIGNATURE === 'true') {
      const signature = req.headers['x-signature-ed25519'] as string;
      const timestamp = req.headers['x-signature-timestamp'] as string;
      
      if (!signature || !timestamp) {
        log('Missing Discord signature headers', 'discord');
        return res.status(401).json({ error: 'Missing signature headers' });
      }
      
      // Convert request body to string for verification if it's not already a string
      const rawBody = typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);
      
      const isValid = verifyDiscordSignature(publicKey, signature, timestamp, rawBody);
      if (!isValid) {
        log('Invalid Discord webhook signature', 'discord');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Handle Discord interactions
    const interaction = req.body;
    
    if (!interaction || typeof interaction !== 'object') {
      log('Invalid interaction payload', 'discord');
      return res.status(400).json({ error: 'Invalid interaction payload' });
    }
    
    // Handle Discord's PING challenge when registering the webhook
    if (interaction.type === 1) {
      log('Responding to Discord PING challenge', 'discord');
      return res.json({ type: 1 }); // Type 1 response is PONG
    }
    
    // Handle incoming messages (type 2 is APPLICATION_COMMAND)
    if (interaction.type === 2) {
      return await handleCommand(interaction, res);
    }
    
    // Handle message components (type 3 is MESSAGE_COMPONENT)
    if (interaction.type === 3) {
      return await handleMessageComponent(interaction, res);
    }
    
    // Handle regular messages (type 0 is DISPATCH, for bots in Gateway mode)
    if (interaction.type === 0 && interaction.message) {
      return await handleMessage(interaction, res);
    }
    
    // Default response for unsupported interaction types
    log(`Unsupported interaction type: ${interaction.type}`, 'discord');
    return res.json({ 
      type: 4, 
      data: { 
        content: "This type of interaction is not supported" 
      } 
    });
  
  } catch (error) {
    const errorMessage = (error as Error).message;
    const errorStack = (error as Error).stack;
    log(`Discord webhook error: ${errorMessage}\n${errorStack}`, 'discord');
    
    // Return a more specific error response
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? errorMessage : 'An unexpected error occurred'
    });
  }
}

/**
 * Handle a Discord command interaction
 */
async function handleCommand(interaction: any, res: Response) {
  const { guild_id, member, data, channel_id } = interaction;
  const commandName = data.name;
  
  log(`Received Discord command: ${commandName}`, 'discord');
  
  try {
    // Find the bot associated with this guild
    // In a real implementation, you'd look up the bot by guild_id
    const bots = await storage.getBots(1); // For demo, using userId 1
    const discordBot = bots.find(bot => bot.platformType === 'discord');
    
    if (!discordBot) {
      return res.json({
        type: 4, // CHANNEL_MESSAGE
        data: {
          content: "No Discord bot configured for this server."
        }
      });
    }
    
    // Get command mappings for this bot
    const commandMappings = await storage.getCommandMappings(discordBot.userId);
    const botCommands = commandMappings.filter(cmd => cmd.botId === discordBot.id);
    
    // Find a matching command
    const matchedCommand = botCommands.find(cmd => 
      cmd.name.toLowerCase() === commandName.toLowerCase()
    );
    
    if (matchedCommand) {
      // Process command options to extract parameters
      const options = data.options || [];
      const params: Record<string, string> = {};
      
      options.forEach((opt: any) => {
        params[opt.name] = opt.value;
      });
      
      // Replace parameters in command output
      let commandOutput = matchedCommand.commandOutput;
      Object.keys(params).forEach(key => {
        commandOutput = commandOutput.replace(`{${key}}`, params[key]);
      });
      
      // Track command usage
      await storage.incrementCommandUsage(matchedCommand.id);
      
      // Record activity
      await storage.createActivity({
        userId: discordBot.userId,
        activityType: 'command_used',
        description: `Command "${matchedCommand.name}" was used in Discord`,
        metadata: {
          commandId: matchedCommand.id,
          guildId: guild_id,
          channelId: channel_id,
          userId: member?.user?.id,
          input: JSON.stringify(data),
          output: commandOutput
        }
      });
      
      // Respond with the command output
      return res.json({
        type: 4, // CHANNEL_MESSAGE
        data: {
          content: commandOutput
        }
      });
    } else {
      // No matching command found
      return res.json({
        type: 4, // CHANNEL_MESSAGE
        data: {
          content: "Command not found."
        }
      });
    }
  } catch (error) {
    log(`Error processing Discord command: ${(error as Error).message}`, 'discord');
    return res.json({
      type: 4, // CHANNEL_MESSAGE
      data: {
        content: "Error processing command."
      }
    });
  }
}

/**
 * Handle a regular Discord message
 */
async function handleMessage(interaction: any, res: Response) {
  const { guild_id, author, content, channel_id } = interaction;
  
  // Skip bot messages
  if (author?.bot) {
    return res.status(200).end();
  }
  
  log(`Received Discord message: ${content}`, 'discord');
  
  try {
    const userId = author.id;
    
    // Get the bots that are managed by the system
    const bots = await storage.getBots(1); // For demo, using userId 1
    const discordBot = bots.find(bot => bot.platformType === 'discord' && bot.isConnected);
    
    if (!discordBot) {
      // No bot found, just ignore the message
      return res.status(200).end();
    }
    
    // Check if the bot is mentioned in the message
    const botMentionPattern = new RegExp(`@${discordBot.botName}\\b`, 'i');
    if (!botMentionPattern.test(content)) {
      // Bot wasn't mentioned, ignore the message
      return res.status(200).end();
    }
    
    // Remove the bot mention from the message for processing
    const cleanMessage = content.replace(botMentionPattern, '').trim();
    
    // Check if there's an ongoing conversation
    const conversation = getConversation(userId, channel_id);
    
    if (conversation?.clarificationQuestion) {
      // This is a response to a clarification question
      if (isAffirmativeResponse(content)) {
        // User confirmed the command
        if (conversation.pendingCommand) {
          // Execute the confirmed command
          const { commandId, params } = conversation.pendingCommand;
          
          // Get the full command
          const command = await storage.getCommandMapping(commandId);
          
          if (command) {
            // Apply parameters to template
            let commandOutput = command.commandOutput;
            Object.entries(params).forEach(([key, value]) => {
              commandOutput = commandOutput.replace(`{${key}}`, value);
            });
            
            // Record command usage
            await storage.incrementCommandUsage(commandId);
            
            // Record activity
            await storage.createActivity({
              userId: 1, // For demo, using userId 1
              activityType: 'command_used',
              description: `Command "${command.name}" was confirmed after clarification in Discord`,
              metadata: {
                commandId,
                guildId: guild_id,
                channelId: channel_id,
                userId,
                input: conversation.originalMessage || content,
                output: commandOutput
              }
            });
            
            // Clear the conversation
            endConversation(userId, channel_id);
            
            // Send the command output
            return res.json({
              type: 4, // CHANNEL_MESSAGE
              data: {
                content: commandOutput
              }
            });
          }
        }
      } else if (isNegativeResponse(content)) {
        // User rejected the command
        endConversation(userId, channel_id);
        
        return res.json({
          type: 4, // CHANNEL_MESSAGE
          data: {
            content: "Command canceled."
          }
        });
      } else {
        // Treat as a new message
        endConversation(userId, channel_id);
      }
    }
    
    // Process the message
    const processResult = useAIProcessing
      ? await processDiscordMessageWithAI(cleanMessage, guild_id, channel_id, userId, false)
      : await processDiscordMessage(cleanMessage, guild_id, channel_id, userId);
    
    if (processResult.success) {
      // Command found and executed
      return res.json({
        type: 4, // CHANNEL_MESSAGE
        data: {
          content: processResult.response
        }
      });
    } else if (processResult.needsClarification && processResult.clarificationQuestion) {
      // Need clarification
      updateConversation(userId, channel_id, {
        clarificationQuestion: processResult.clarificationQuestion,
        originalMessage: cleanMessage,
        // Store pending command info if we have a likely match
      });
      
      return res.json({
        type: 4, // CHANNEL_MESSAGE
        data: {
          content: processResult.clarificationQuestion
        }
      });
    } else if (processResult.error) {
      // Error processing the message
      return res.json({
        type: 4, // CHANNEL_MESSAGE
        data: {
          content: processResult.error
        }
      });
    }
    
    // No response needed
    return res.status(200).end();
  } catch (error) {
    log(`Error processing Discord message: ${(error as Error).message}`, 'discord');
    return res.json({
      type: 4, // CHANNEL_MESSAGE
      data: {
        content: "Error processing message."
      }
    });
  }
}

/**
 * Handle a Discord message component interaction (buttons, selects, etc.)
 */
async function handleMessageComponent(interaction: any, res: Response) {
  const { custom_id } = interaction.data;
  
  log(`Received Discord component interaction: ${custom_id}`, 'discord');
  
  // Process the custom_id to determine what action to take
  // This is a simple example - you'd expand this based on your needs
  
  return res.json({
    type: 4, // CHANNEL_MESSAGE
    data: {
      content: `Processed component: ${custom_id}`
    }
  });
} 