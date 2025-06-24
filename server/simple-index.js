const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Initialize Gemini AI
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('🤖 Gemini AI initialized');
} else {
  console.warn('⚠️ GEMINI_API_KEY not found - AI features will be limited');
}

// EXACT MIGRATION FROM LOCAL TYPESCRIPT SYSTEM

/**
 * Check if input is purely conversational (from local system)
 */
function isConversationalInput(input) {
  const conversationalPatterns = [
    /^(hi|hello|hey)[\s!]*$/i,
    /^how are you[\s?]*$/i,
    /^what's up[\s?]*$/i,
    /^whats up[\s?]*$/i,
    /^wassup[\s?]*$/i,
    /^good (morning|afternoon|evening)[\s!]*$/i,
    /^thank you[\s!]*$/i,
    /^thanks[\s!]*$/i,
    /^(im great|not much|good|fine).*$/i,
    /^(lol|haha|awesome|nice|wow)[\s!]*$/i,
    /^(yes|no|sure|maybe|alright)[\s!]*$/i,
    /^(ok|okay|cool|got it|gotcha)[\s!]*$/i,
    /^(i'm good|i'm fine|i'm great|i'm okay).*$/i,
    /^(doing good|doing well|doing fine|doing great|doing awesome).*$/i,
    /^not much[\s,].*$/i,
    /^just.*$/i,
    /^nothing much[\s,].*$/i
  ];
  
  return conversationalPatterns.some(pattern => pattern.test(input.trim()));
}

/**
 * Extract parameters from message using fallback method (from local system)
 */
function extractParametersFallback(message, commandPattern) {
  const extractedParams = {};
  
  // Extract user mentions from text
  const userMentionMatch = message.match(/<@!?(\d+)>/);
  if (userMentionMatch) {
    extractedParams.user = userMentionMatch[1];
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
    if (commandPattern.includes('{amount}')) {
      extractedParams.amount = number;
    }
    if (commandPattern.includes('{duration}')) {
      extractedParams.duration = number + 'm';
    }
  }
  
  // Extract message content for say command
  if (commandPattern.includes('{message}')) {
    const sayMatch = message.match(/say\s+(.*)/i);
    if (sayMatch) {
      extractedParams.message = sayMatch[1];
    }
  }
  
  return extractedParams;
}

/**
 * Extract Discord mentions from message for better AI processing (from local system)
 */
function preprocessDiscordMessage(message) {
  const extractedMentions = {};
  
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
 * Create a comprehensive prompt for AI analysis (EXACT from local TypeScript)
 */
function createAnalysisPrompt(message, availableCommands, botPersonality, conversationContext) {
  const commandList = availableCommands.map(cmd => 
    `- ID: ${cmd.id}, Name: ${cmd.name}, Pattern: ${cmd.natural_language_pattern}, Output: ${cmd.command_output}`
  ).join('\n');

  // Use provided personality context or generate a default one
  const personalityContext = botPersonality || 
    "You are a helpful Discord bot assistant that can handle moderation commands and casual conversation. You're friendly, efficient, and great at understanding natural language.";

  // Add conversation context if available
  const contextSection = conversationContext 
    ? `\n\nCONVERSATION CONTEXT:\n${conversationContext}\n`
    : '';

  return `${personalityContext}

${contextSection}You are an advanced natural language processor for Discord bot commands. Your job is to:
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
- ❌ Pure greetings ("hi", "hello", "how are you", "wassup", "what's up")
- ❌ Questions about the bot's capabilities ("what can you do", "help", "commands")
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

⚡ **BE BOLD**: If you can extract ANY meaningful parameters and understand the intent, EXECUTE the command. Don't ask for clarification unless truly necessary!`;
}

/**
 * Parse the AI response (EXACT from local TypeScript)
 */
function parseAIResponse(content) {
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
    console.log(`Error parsing AI response: ${error.message}`);
    return {
      isCommand: false,
      conversationalResponse: "I'm here to help! You can chat with me or give me moderation commands."
    };
  }
}

/**
 * Analyze a message with AI for command/conversational intent (EXACT from local TypeScript)
 */
async function analyzeMessageWithAI(message, availableCommands, botPersonality, conversationContext) {
  try {
    // Preprocess message to extract Discord mentions
    const { cleanMessage, extractedMentions } = preprocessDiscordMessage(message);
    
    // Add mention information to the message for AI processing
    let enhancedMessage = cleanMessage;
    if (Object.keys(extractedMentions).length > 0) {
      enhancedMessage += `\n\nEXTRACTED_MENTIONS: ${JSON.stringify(extractedMentions)}`;
    }
    
    const prompt = createAnalysisPrompt(enhancedMessage, availableCommands, botPersonality, conversationContext);
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    if (!content) {
      throw new Error("Empty response from Gemini");
    }
    
    return parseAIResponse(content);
    
  } catch (error) {
    console.log(`Error in AI analysis: ${error.message}`);
    
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
 * EXACT MAIN PROCESSING FUNCTION FROM LOCAL TYPESCRIPT SYSTEM
 * Process Discord message with AI (EXACT migration from messageHandlerAI.ts)
 */
async function processDiscordMessageWithAI(message, guildId, channelId, userId, skipMentionCheck = false, authenticatedUserId, conversationContext) {
  try {
    if (!message || typeof message !== 'string') {
      return { processed: false };
    }
    
    // First check if the bot was mentioned, if not mentioned we don't process
    const botMentionRegex = /<@\!?(\d+)>/;
    const botMentioned = botMentionRegex.test(message);
    
    if (!botMentioned && !skipMentionCheck) {
      return { processed: false };
    }
    
    // Remove mention from the message to process the actual command
    const cleanMessage = message.replace(botMentionRegex, '').trim();
    if (!cleanMessage && !skipMentionCheck) {
      return {
        processed: true,
        conversationalResponse: "Hello! How can I help you today? I can help with moderation commands or just chat!"
      };
    }
    
    // For skipMentionCheck (replies), use the original message if cleanMessage is empty
    const messageToProcess = cleanMessage || (skipMentionCheck ? message : '');
    if (!messageToProcess) {
      return {
        processed: true,
        conversationalResponse: "Hello! How can I help you today? I can help with moderation commands or just chat!"
      };
    }
    
    // Use the authenticated user ID if provided, otherwise fall back to user ID 1
    const userIdToUse = authenticatedUserId || "user_2yMTRvIng7ljDfRRUlXFvQkWSb5";

    // Get all command mappings for the user
    const { data: commands, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('user_id', userIdToUse);
      
    if (error || !commands || commands.length === 0) {
      console.log(`No commands found for user ${userIdToUse}`);
      return {
        processed: true,
        conversationalResponse: "Hi there! I don't have any commands configured yet, but I'm happy to chat!"
      };
    }

    // Get the bot personality context
    const { data: bots, error: botError } = await supabase
      .from('bot_connections')
      .select('personality_context')
      .eq('user_id', userIdToUse)
      .limit(1);
    
    const bot = bots && bots.length > 0 ? bots[0] : null;
    
    // Process the message with enhanced AI logic (EXACT from local system)
    const analysisResult = await analyzeMessageWithAI(
      messageToProcess, 
      commands, 
      bot?.personality_context || undefined,
      conversationContext
    );
    
    // Handle different types of responses (EXACT from local system)
    if (analysisResult.isCommand && analysisResult.bestMatch) {
      // This is a command - execute it
      const command = commands.find(cmd => cmd.id.toString() === analysisResult.bestMatch.commandId.toString());
      
      if (!command) {
        console.log(`Command with ID ${analysisResult.bestMatch.commandId} not found`);
        return {
          processed: true,
          conversationalResponse: "I found a command but couldn't execute it. Please try again!"
        };
      }
      
      // Apply fallback parameter extraction if AI missed Discord mentions
      const fallbackParams = extractParametersFallback(message, command.natural_language_pattern);
      
      // Merge params properly - don't let fallback override AI results unless AI missed them
      const finalParams = {};
      
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
      let outputCommand = command.command_output;
      
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
      await supabase
        .from('command_mappings')
        .update({ usage_count: (command.usage_count || 0) + 1 })
        .eq('id', command.id);
      
      // Log activity
      await supabase
        .from('activities')
        .insert({
          user_id: userIdToUse,
          activity_type: 'command_used',
          description: `Command mapping '${command.name}' was used via Discord`,
          metadata: {
            guildId,
            channelId,
            discordUserId: userId,
            userMessage: messageToProcess,
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
    console.log(`Error processing Discord message with AI: ${error.message}`);
    return {
      processed: true,
      conversationalResponse: "Sorry, I had some trouble processing that. Could you try again?"
    };
  }
}

// API Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Commandless Discord Bot Server is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Discord API endpoint for Universal Relay Service
app.post('/api/discord', async (req, res) => {
  try {
    const { action } = req.query;
    
    if (action === 'process-message') {
      const { message: messageData, botToken, botClientId, skipMentionCheck } = req.body;
      
      if (!messageData || !botToken) {
        return res.json({
          processed: false,
          reason: 'Missing message data or bot token'
        });
      }

      console.log(`🔍 Processing message via API: "${messageData.content}" from ${messageData.author.username}`);
      console.log(`   Skip mention check: ${skipMentionCheck || false}`);
      
      // Use the EXACT local processing function
      const result = await processDiscordMessageWithAI(
        messageData.content,
        messageData.guild_id,
        messageData.channel_id,
        messageData.author.id,
        skipMentionCheck || false, // Use skipMentionCheck from request
        "user_2yMTRvIng7ljDfRRUlXFvQkWSb5", // authenticatedUserId
        undefined // conversationContext
      );
      
      if (result.processed && result.conversationalResponse) {
        console.log(`🤖 API Response: ${result.conversationalResponse}`);
        return res.json({
          processed: true,
          response: result.conversationalResponse
        });
      } else if (result.processed && result.command) {
        console.log(`🎯 Command executed: ${result.command}`);
        return res.json({
          processed: true,
          response: `Command executed: ${result.command}`
        });
      } else if (result.needsClarification) {
        console.log(`❓ Clarification needed: ${result.clarificationQuestion}`);
        return res.json({
          processed: true,
          response: result.clarificationQuestion
        });
      } else {
        return res.json({
          processed: false,
          reason: 'No response generated'
        });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Discord API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An error occurred while processing the Discord API request.'
    });
  }
});

app.get('/api/discord', (req, res) => {
  const { action } = req.query;
  
  if (action === 'process-message') {
    res.json({
      processed: false,
      reason: 'GET method not supported for process-message'
    });
  } else {
    res.json({
      processed: false,
      reason: 'Unknown action'
    });
  }
});

// Start server
console.log('✅ Configuration validated successfully');

app.listen(PORT, () => {
  console.log(`🚀 Commandless server running on port ${PORT}`);
  console.log(`🤖 Gemini AI initialized`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
}); 