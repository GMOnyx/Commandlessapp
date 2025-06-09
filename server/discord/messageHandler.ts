import { storage } from '../storage';
import { findMatchingCommands, applyParamsToTemplate } from './naturalLanguageProcessor';
import { log } from '../vite';

/**
 * Process a message from Discord and find matched commands
 * 
 * @param message The message content to process
 * @param guildId Discord server/guild ID
 * @param channelId Discord channel ID 
 * @param userId Discord user ID
 * @returns Processing result with matched command and response
 */
export async function processDiscordMessage(
  message: string,
  guildId: string,
  channelId: string,
  userId: string
): Promise<{ 
  success: boolean; 
  response?: string; 
  error?: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
}> {
  try {
    log(`Processing Discord message: "${message}"`, 'discord');
    
    // Skip processing for empty messages or bot commands
    if (!message || message.trim() === '' || message.startsWith('!')) {
      return { success: false };
    }
    
    // For a real implementation, we would look up the bot by guild ID
    // Here we're using a simplified approach for demo purposes
    const bots = await storage.getBots(1); // Using userId 1 for demo
    const discordBot = bots.find(bot => bot.platformType === 'discord');
    
    if (!discordBot) {
      log(`No Discord bot found for guild ${guildId}`, 'discord');
      return { 
        success: false, 
        error: 'No Discord bot configured for this server' 
      };
    }
    
    // Check if the bot is connected
    if (!discordBot.isConnected) {
      log(`Discord bot is not connected: ${discordBot.botName}`, 'discord');
      return { 
        success: false, 
        error: 'Bot is not connected' 
      };
    }
    
    // Get command mappings for this bot
    const allCommandMappings = await storage.getCommandMappings(discordBot.userId);
    const botCommands = allCommandMappings.filter(cmd => cmd.botId === discordBot.id);
    
    if (botCommands.length === 0) {
      log('No command mappings found for this bot', 'discord');
      return { 
        success: false, 
        error: 'No commands configured for this bot' 
      };
    }
    
    // Find matching commands
    const matchingCommands = findMatchingCommands(message, botCommands);
    
    if (matchingCommands.length === 0) {
      log('No matching commands found', 'discord');
      return { 
        success: false, 
        error: 'No matching command patterns' 
      };
    }
    
    // Use the first matching command (could implement priority logic here)
    const { command, params } = matchingCommands[0];
    
    // Apply parameters to the command output template
    const commandOutput = applyParamsToTemplate(command.commandOutput, params);
    
    // Record command usage
    await storage.incrementCommandUsage(command.id);
    
    // Record activity
    await storage.createActivity({
      userId: discordBot.userId,
      activityType: 'command_used',
      description: `Command "${command.name}" was triggered by natural language in Discord`,
      metadata: {
        commandId: command.id,
        guildId,
        channelId,
        userId,
        input: message,
        output: commandOutput
      }
    });
    
    log(`Command matched: "${command.name}" with output: "${commandOutput}"`, 'discord');
    
    return {
      success: true,
      response: commandOutput
    };
    
  } catch (error) {
    const errorMessage = (error as Error).message;
    log(`Error processing Discord message: ${errorMessage}`, 'discord');
    return { 
      success: false, 
      error: `Error processing message: ${errorMessage}` 
    };
  }
} 