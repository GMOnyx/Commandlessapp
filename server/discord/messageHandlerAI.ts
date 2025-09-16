import { storage } from '../storage';
import { log } from '../vite';
import { geminiClient, validateGeminiConfig } from '../gemini/client';
import { translateToCommand } from '../gemini/index';

/**
 * Process a Discord message using AI to detect and execute commands or respond conversationally
 * 
 * @param message The message content to process
 * @param guildId The Discord server ID
 * @param channelId The Discord channel ID
 * @param userId The Discord user ID
 * @param skipMentionCheck Whether to skip checking for @mention (for testing)
 * @param authenticatedUserId The ID of the authenticated user who owns the command mappings
 * @param conversationContext The context of the conversation
 * @returns Processing result
 */
export async function processDiscordMessageWithAI(
  message: string,
  guildId: string,
  channelId: string,
  userId: string,
  skipMentionCheck: boolean = false,
  authenticatedUserId?: string,
  conversationContext?: string
): Promise<{
  processed: boolean;
  command?: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  conversationalResponse?: string;
}> {
  try {
    // Check if Gemini is configured
    if (!validateGeminiConfig()) {
      log('Gemini API not configured, skipping AI processing', 'discord');
      return { processed: false };
    }
    
    // First check if the bot was mentioned, if not mentioned we don't process
    // Convention in Discord is <@botId> for user mentions
    const botMentionRegex = /<@\!?(\d+)>/;
    const botMentioned = botMentionRegex.test(message);
    
    if (!botMentioned && !skipMentionCheck) {
      // Not mentioned and we're not skipping the check
      return { processed: false };
    }
    
    // Remove mention from the message to process the actual command
    const cleanMessage = message.replace(botMentionRegex, '').trim();
    if (!cleanMessage && !skipMentionCheck) {
      // Just a mention with no actual content
      return {
        processed: true,
        conversationalResponse: "Hello! How can I help you today? I can help with moderation commands or just chat!"
      };
    }
    
    // Use the authenticated user ID if provided, otherwise fall back to user ID 1 for in-memory storage
    const userIdToUse = authenticatedUserId || "1";

    // Get all command mappings for the user
    const commands = await storage.getCommandMappings(userIdToUse);
    if (!commands || commands.length === 0) {
      log(`No commands found for user ${userIdToUse}`, 'discord');
      return {
        processed: true,
        conversationalResponse: "Hi there! I don't have any commands configured yet, but I'm happy to chat!"
      };
    }

    // Get the first bot to use its personality context (in a real scenario, you'd match by guild)
    const bots = await storage.getBots(userIdToUse);
    const bot = bots.length > 0 ? bots[0] : null;
    
    // Process the message with enhanced AI logic
    const analysisResult = await analyzeMessageWithAI(
      cleanMessage, 
      commands, 
      bot?.personalityContext || undefined,
      conversationContext
    );
    
    // Handle different types of responses
    if (analysisResult.isCommand && analysisResult.bestMatch) {
      // This is a command - execute it
      const command = await storage.getCommandMapping(analysisResult.bestMatch.commandId.toString());
      
      if (!command) {
        log(`Command with ID ${analysisResult.bestMatch.commandId} not found`, 'discord');
        return {
          processed: true,
          conversationalResponse: "I found a command but couldn't execute it. Please try again!"
        };
      }
      
      // Apply fallback parameter extraction if AI missed Discord mentions
      const fallbackParams = extractParametersFallback(message, command.naturalLanguagePattern);
      
      // FIXED: Merge params properly - don't let fallback override AI results unless AI missed them
      const finalParams: Record<string, string> = {};
      
      // Start with AI extracted parameters
      if (analysisResult.bestMatch.params) {
        Object.assign(finalParams, analysisResult.bestMatch.params);
      }
      
      // Only add fallback parameters if AI didn't extract them
      for (const [key, value] of Object.entries(fallbackParams)) {
        if (!finalParams[key] || !finalParams[key].trim()) {
          finalParams[key] = value;
        }
      }
      
      // Build the command output using extracted parameters
      let outputCommand = command.commandOutput;
      
      // Replace placeholders with extracted parameters
      if (finalParams) {
        for (const [key, value] of Object.entries(finalParams)) {
          if (value && value.trim()) {
            outputCommand = outputCommand.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
          }
        }
      }
      
      // Replace any remaining placeholders with defaults
      outputCommand = outputCommand.replace(/\{reason\}/g, 'No reason provided');
      outputCommand = outputCommand.replace(/\{message\}/g, 'No message provided');
      outputCommand = outputCommand.replace(/\{amount\}/g, '1');
      outputCommand = outputCommand.replace(/\{duration\}/g, '5m');
      outputCommand = outputCommand.replace(/\{user\}/g, 'target user');
      
      // Only ask for clarification if confidence is very low (< 0.6)
      if (analysisResult.bestMatch.confidence < 0.6) {
        return {
          processed: true,
          needsClarification: true,
          clarificationQuestion: analysisResult.clarificationQuestion || 
            `I think you want to use a command, but I'm not sure about the details. Can you be more specific?`
        };
      }
      
      // Increment usage count
      await storage.incrementCommandUsage(command.id);
      
      // Log activity
      await storage.createActivity({
        userId: userIdToUse,
        activityType: 'command_used',
        description: `Command mapping '${command.name}' was used via Discord`,
        metadata: {
          guildId,
          channelId,
          discordUserId: userId,
          userMessage: cleanMessage,
          commandOutput: outputCommand
        }
      });
      
      return {
        processed: true,
        command: outputCommand
      };
    } else {
      // This is casual conversation - respond appropriately
      return {
        processed: true,
        conversationalResponse: analysisResult.conversationalResponse
      };
    }
    
  } catch (error) {
    log(`Error processing Discord message with AI: ${(error as Error).message}`, 'discord');
    return {
      processed: true,
      conversationalResponse: "Sorry, I had some trouble processing that. Could you try again?"
    };
  }
}

interface AIAnalysisResult {
  isCommand: boolean;
  bestMatch?: {
    commandId: number;
    confidence: number;
    params: Record<string, string>;
  };
  conversationalResponse?: string;
  clarificationQuestion?: string;
}

/**
 * Extract Discord mentions from message for better AI processing
 */
function preprocessDiscordMessage(message: string): { cleanMessage: string; extractedMentions: Record<string, string> } {
  const extractedMentions: Record<string, string> = {};
  
  // Extract user mentions <@123456789> or <@!123456789>
  const userMentions = message.match(/<@!?(\d+)>/g);
  if (userMentions) {
    userMentions.forEach((mention, index) => {
      const userId = mention.match(/<@!?(\d+)>/)?.[1];
      if (userId) {
        extractedMentions[`user_mention_${index}`] = userId;
      }
    });
  }
  
  // Extract channel mentions <#123456789>
  const channelMentions = message.match(/<#(\d+)>/g);
  if (channelMentions) {
    channelMentions.forEach((mention, index) => {
      const channelId = mention.match(/<#(\d+)>/)?.[1];
      if (channelId) {
        extractedMentions[`channel_mention_${index}`] = channelId;
      }
    });
  }
  
  // Extract role mentions <@&123456789>
  const roleMentions = message.match(/<@&(\d+)>/g);
  if (roleMentions) {
    roleMentions.forEach((mention, index) => {
      const roleId = mention.match(/<@&(\d+)>/)?.[1];
      if (roleId) {
        extractedMentions[`role_mention_${index}`] = roleId;
      }
    });
  }
  
  return {
    cleanMessage: message,
    extractedMentions
  };
}

/**
 * Analyze a message with AI for command/conversational intent
 */
async function analyzeMessageWithAI(
  message: string,
  availableCommands: any[],
  botPersonality?: string,
  conversationContext?: string
): Promise<AIAnalysisResult> {
  try {
    // Preprocess message to extract Discord mentions
    const { cleanMessage, extractedMentions } = preprocessDiscordMessage(message);
    
    // Add mention information to the message for AI processing
    let enhancedMessage = cleanMessage;
    if (Object.keys(extractedMentions).length > 0) {
      enhancedMessage += `\n\nEXTRACTED_MENTIONS: ${JSON.stringify(extractedMentions)}`;
    }
    
    const prompt = createAnalysisPrompt(enhancedMessage, availableCommands, botPersonality, conversationContext);
    
    const model = geminiClient.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    if (!content) {
      throw new Error("Empty response from Gemini");
    }
    
    return parseAIResponse(content);
    
  } catch (error) {
    log(`Error in AI analysis: ${(error as Error).message}`, 'discord');
    
    // Fallback: check if message contains common command words
    const commandWords = ['ban', 'kick', 'warn', 'mute', 'purge', 'role'];
    const isLikelyCommand = commandWords.some(word => 
      message.toLowerCase().includes(word)
    );
    
    if (isLikelyCommand) {
      return {
        isCommand: true,
        clarificationQuestion: "I think you want to use a command, but I'm having trouble understanding. Could you be more specific?"
      };
    } else {
      return {
        isCommand: false,
        conversationalResponse: "I'm here and ready to help! Feel free to ask me anything or give me a command."
      };
    }
  }
}

/**
 * Create a comprehensive prompt for AI analysis
 */
function createAnalysisPrompt(message: string, availableCommands: any[], botPersonality?: string, conversationContext?: string): string {
  const commandList = availableCommands.map(cmd => 
    `- ID: ${cmd.id}, Name: ${cmd.name}, Pattern: ${cmd.naturalLanguagePattern}, Output: ${cmd.commandOutput}`
  ).join('\n');

  // Use provided personality context or generate a default one
  const personalityContext = botPersonality || 
    "You are a helpful Discord bot assistant that can handle moderation commands and casual conversation. You're friendly, efficient, and great at understanding natural language.";

  // Add conversation context if available
  const contextSection = conversationContext 
    ? `\n\nCONVERSATION CONTEXT:\n${conversationContext}\n`
    : '';

  return `${personalityContext}

${contextSection}LANGUAGE POLICY:
- Detect the user's language from USER MESSAGE.
- Respond conversationally in that same language for any conversationalResponse or clarificationQuestion.
- Keep any JSON keys/fields in English.
- You may internally translate input to English to understand commands, but outputs that are natural language must remain in the user's language.

You are an advanced natural language processor for Discord bot commands. Your job is to:
1. **Determine if the user wants to execute a command OR have casual conversation**
2. **Extract parameters aggressively and intelligently from natural language**
3. **Be decisive - execute commands when intent is clear, even with informal language**

AVAILABLE COMMANDS:
${commandList}

🎯 **PARAMETER EXTRACTION MASTERY:**

**Discord Mentions**: Extract user IDs from any mention format:
- "warn <@560079402013032448> for spamming" → user: "560079402013032448"
- "please mute <@!123456> because annoying" → user: "123456"
- "ban that toxic <@999888> user" → user: "999888"

**Natural Language Patterns**: Understand ANY phrasing that indicates command intent:
- "can you delete like 5 messages please" → purge command, amount: "5"
- "remove that user from the server" → ban command
- "give them a warning for being rude" → warn command
- "tell everyone the meeting is starting" → say command
- "check how fast you are" → ping command
- "what server are we in" → server-info command

**Context-Aware Extraction**: Look at the ENTIRE message for parameters:
- "nothing much just warn <@560079402013032448> for being annoying" 
  → EXTRACT: user: "560079402013032448", reason: "being annoying"
- "hey bot, when you have time, could you ban <@123> for trolling everyone"
  → EXTRACT: user: "123", reason: "trolling everyone"
- "that user <@999> has been really helpful, make a note about it"
  → EXTRACT: user: "999", message: "has been really helpful"

**Semantic Understanding**: Map natural language to command actions:
- "remove/get rid of/kick out" → ban
- "tell everyone/announce/broadcast" → say
- "delete/clear/clean up messages" → purge
- "stick/attach this message" → pin
- "give warning/issue warning" → warn
- "check speed/latency/response time" → ping
- "server details/info/stats" → server-info

**Multi-Parameter Intelligence**: Extract complete information:
- "warn john for being toxic and breaking rules repeatedly" 
  → user: "john", reason: "being toxic and breaking rules repeatedly"
- "please purge about 15 messages to clean this up"
  → amount: "15"
- "tell everyone 'meeting moved to 3pm tomorrow'"
  → message: "meeting moved to 3pm tomorrow"

🔥 **DECISION MAKING RULES:**

**EXECUTE IMMEDIATELY IF:**
- ✅ Clear command intent (even with casual phrasing)
- ✅ ANY required parameters can be extracted
- ✅ User mentions someone with @ symbol for moderation commands
- ✅ Numbers found for amount-based commands (purge, slowmode)
- ✅ Message content found for say/note commands

**CASUAL CONVERSATION IF:**
- ❌ No command-related words or intent
- ❌ Pure greetings ("hi", "hello", "how are you")
- ❌ Questions about the bot's capabilities
- ❌ General chat without action words

**CONFIDENCE SCORING:**
- 90-100: Perfect match with all parameters extracted
- 80-89: Clear intent with most important parameters
- 70-79: Good intent with some parameters (STILL EXECUTE)
- 60-69: Likely intent but may need minor clarification
- Below 60: Ask for clarification only if truly ambiguous

USER MESSAGE: "${message}"

🚀 **RESPOND WITH JSON:**

**For COMMANDS (action intent detected):**
\`\`\`json
{
  "isCommand": true,
  "bestMatch": {
    "commandId": <command_id>,
    "confidence": <60-100>,
    "params": {
      "user": "extracted_user_id",
      "reason": "complete reason text",
      "message": "complete message text",
      "amount": "number_as_string"
    }
  }
}
\`\`\`

**For CONVERSATION (no command intent):**
\`\`\`json
{
  "isCommand": false,
  "conversationalResponse": "friendly, helpful response matching bot personality"
}
\`\`\`

**EXAMPLES OF AGGRESSIVE EXTRACTION:**
- "nothing much, just ban <@560079402013032448> for spam" → EXECUTE ban immediately
- "can you please delete like 10 messages" → EXECUTE purge immediately  
- "tell everyone the event is cancelled" → EXECUTE say immediately
- "that user keeps trolling, give them a warning" → EXTRACT context for warn
- "yo bot, how's your ping?" → EXECUTE ping immediately
- "remove this toxic user from server" → Need user ID for ban
- "hi how are you doing?" → CASUAL conversation

⚡ **BE BOLD**: If you can extract ANY meaningful parameters and understand the intent, EXECUTE the command. Don't ask for clarification unless truly necessary!`;
}

/**
 * Parse the AI response
 */
function parseAIResponse(content: string): AIAnalysisResult {
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      isCommand: parsed.isCommand || false,
      bestMatch: parsed.bestMatch || undefined,
      conversationalResponse: parsed.conversationalResponse || undefined,
      clarificationQuestion: parsed.clarificationQuestion || undefined
    };
    
  } catch (error) {
    log(`Error parsing AI response: ${(error as Error).message}`, 'discord');
    return {
      isCommand: false,
      conversationalResponse: "I'm here to help! You can chat with me or give me moderation commands."
    };
  }
}

/**
 * Extract parameters from message using fallback method
 */
function extractParametersFallback(message: string, commandPattern: string): Record<string, string> {
  const extractedParams: Record<string, string> = {};
  
  // FIXED: Extract ALL user mentions and find the target user (not the bot)
  const allUserMentions = message.match(/<@!?(\d+)>/g);
  if (allUserMentions && allUserMentions.length > 0) {
    // Find the target user mention (usually the one that's NOT the bot being mentioned)
    const userIds = allUserMentions.map(mention => {
      const match = mention.match(/<@!?(\d+)>/);
      return match ? match[1] : null;
    }).filter((id): id is string => id !== null);
    
    // If we have multiple mentions, try to determine which is the target
    if (userIds.length > 1) {
      // Skip the first mention if it looks like a bot mention at the start
      const messageWords = message.trim().split(/\s+/);
      if (messageWords[0] && messageWords[0].match(/<@!?\d+>/)) {
        // First word is a mention (likely bot mention), use the second user mentioned
        extractedParams.user = userIds[1];
      } else {
        // Use the first user mentioned if no bot mention at start
        extractedParams.user = userIds[0];
      }
    } else if (userIds.length === 1) {
      // Only one mention - could be bot or target, use it
      extractedParams.user = userIds[0];
    }
  }
  
  // Extract channel mentions <#123456789> and map to 'channel' parameter  
  const channelMention = message.match(/<#(\d+)>/);
  if (channelMention) {
    const channelId = channelMention[1];
    extractedParams.channel = channelId;
  }
  
  // Extract role mentions <@&123456789> and map to 'role' parameter
  const roleMention = message.match(/<@&(\d+)>/);
  if (roleMention) {
    const roleId = roleMention[1];
    extractedParams.role = roleId;
  }
  
  // Extract reason from common patterns
  const reasonPatterns = [
    /(?:for|because|reason:?\s*)(.*?)(?:\s*$)/i,
    /(?:being|they're|he's|she's)\s+(.*?)(?:\s*$)/i
  ];
  
  for (const pattern of reasonPatterns) {
    const reasonMatch = message.match(pattern);
    if (reasonMatch && reasonMatch[1] && reasonMatch[1].trim()) {
      extractedParams.reason = reasonMatch[1].trim();
      break;
    }
  }
  
  // Extract numbers for amounts/duration
  const numberMatch = message.match(/(\d+)/);
  if (numberMatch) {
    const number = numberMatch[1];
    // Check if command pattern contains amount or duration
    if (commandPattern.includes('{amount}')) {
      extractedParams.amount = number;
    }
    if (commandPattern.includes('{duration}')) {
      extractedParams.duration = number + 'm'; // Default to minutes
    }
  }
  
  // Extract message content for say command
  if (commandPattern.includes('{message}')) {
    // Extract everything after "say" command
    const sayMatch = message.match(/say\s+(.*)/i);
    if (sayMatch) {
      extractedParams.message = sayMatch[1];
    }
  }
  
  return extractedParams;
} 