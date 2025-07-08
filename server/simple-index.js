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
 * Helper function to decode JWT and extract user ID
 */
function decodeJWT(token) {
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
    ? `\n\nCONVERSATION CONTEXT:\n${conversationContext}\n\n**CONVERSATION HANDLING:**
- If user is replying to a previous bot message, consider the conversation flow
- Maintain context and provide relevant follow-up responses
- If the reply seems to be continuing a conversation rather than issuing a command, respond conversationally
- **IMPORTANT: Replies can also contain commands! Treat reply messages the same as mentioned messages for command detection**
- Look for conversational cues like "thanks", "ok", "got it", "what about", "also", "and", etc.
- But also look for command cues like "ban", "kick", "warn", "purge", "say", etc. even in replies\n`
    : '';

  return `${personalityContext}

${contextSection}You are an advanced natural language processor for Discord bot commands. Your job is to:
1. **Determine if the user wants to execute a command OR have casual conversation**
2. **Extract parameters aggressively and intelligently from natural language**
3. **Be decisive - execute commands when intent is clear, even with informal language**
4. **Handle help requests and capability questions conversationally**

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
- ❌ **HELP/CAPABILITY QUESTIONS**: "what can you do", "show commands", "list commands", "help me", "command list", "make a command list", etc.
- ❌ General chat without action words
- ❌ Conversational replies to previous bot messages ("thanks", "ok", "cool", "got it", "im great", "not much", "good", "fine")
- ❌ Follow-up questions about previous responses
- ❌ Emotional responses ("lol", "haha", "awesome", "nice", "wow")
- ❌ Short acknowledgments ("yes", "no", "sure", "maybe", "alright")

**KEY INSIGHT**: Questions about capabilities ("what can you do", "make a command list") = HELP REQUESTS = Conversational response with command information, NOT executing commands!

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
  "conversationalResponse": "friendly, helpful response that maintains conversation flow and references previous context when appropriate. For help requests, provide command information."
}
\`\`\`

**EXAMPLES OF CONVERSATION FLOW:**
- Reply to "wassup?" → "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎"
- Reply to "thanks" after command execution → "You're welcome! Happy to help. Anything else you need?"
- "what can you do?" → List available commands with friendly explanation
- "what do you do?" → Explain capabilities and show command list

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

    // **CRITICAL PREPROCESSING**: Check for conversational input BEFORE AI
    // This matches the sophisticated local TypeScript system
    if (isConversationalInput(cleanMessage)) {
      console.log(`🎯 CONVERSATIONAL INPUT DETECTED: "${cleanMessage}" - Bypassing aggressive AI`);
      
      // Return appropriate conversational response based on input
      const lowerMessage = cleanMessage.toLowerCase();
      
      if (lowerMessage.includes('wassup') || lowerMessage.includes('what\'s up') || lowerMessage.includes('whats up')) {
        console.log(`🎯 WASSUP DETECTED: Returning conversational response for "${cleanMessage}"`);
        return {
          processed: true,
          conversationalResponse: "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎"
        };
      } else if (lowerMessage.includes('how') && (lowerMessage.includes('going') || lowerMessage.includes('doing'))) {
        return {
          processed: true,
          conversationalResponse: "I'm doing great! Running smooth and ready for action. How about you? Need help with anything? 🚀"
        };
      } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        return {
          processed: true,
          conversationalResponse: "Hello! I'm your AI Discord bot. You can give me natural language commands and I'll execute them intelligently."
        };
      } else if (lowerMessage.includes('help')) {
        const commandNames = commands.map(cmd => cmd.name).slice(0, 5);
        return {
          processed: true,
          conversationalResponse: `I can help with these commands: ${commandNames.join(', ')}. Try using natural language like "execute ${commandNames[0]}" or just mention the command name!`
        };
      } else {
        // Default conversational response for other patterns
        return {
          processed: true,
          conversationalResponse: "Hey! What's up? I'm here and ready to help with whatever you need!"
        };
      }
    } else {
      console.log(`🎯 NOT CONVERSATIONAL: "${cleanMessage}" - Proceeding to AI analysis`);
    }

    // **EXACT LOCAL IMPLEMENTATION**: Check for help requests BEFORE AI processing
    const lowerMessage = cleanMessage.toLowerCase();
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you do') || lowerMessage.includes('commands')) {
      console.log(`🎯 HELP REQUEST DETECTED: "${cleanMessage}" - Bypassing AI`);
      const commandNames = commands.map(cmd => cmd.name).slice(0, 5);
      return {
        processed: true,
        conversationalResponse: `I can help with these commands: ${commandNames.join(', ')}. Try using natural language like "execute ${commandNames[0]}" or just mention the command name!`
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
      cleanMessage, 
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
      const { message: messageData, botToken, botClientId } = req.body;
      
      if (!messageData || !botToken) {
        return res.json({
          processed: false,
          reason: 'Missing message data or bot token'
        });
      }

      console.log(`🔍 Processing message via API: "${messageData.content}" from ${messageData.author.username}`);
      
      // BUILD CONVERSATION CONTEXT (MIGRATED FROM LOCAL IMPLEMENTATION)
      let conversationContext = '';
      
      // Check if this is a reply to a previous message
      if (messageData.referenced_message) {
        console.log(`🔗 Reply detected to message: ${messageData.referenced_message.id}`);
        
        // Build more sophisticated referenced message context
        if (messageData.referenced_message.author && messageData.referenced_message.author.id === botClientId) {
          // This is a reply to the bot - build comprehensive conversation context
          const referencedContent = messageData.referenced_message.content || 'bot response';
          conversationContext = `Previous bot message context: "${referencedContent}" - User is replying to this bot response`;
          console.log(`🧠 Adding conversation context for bot reply: ${conversationContext}`);
        } else if (messageData.referenced_message.author) {
          // This is a reply to another user
          const referencedAuthor = messageData.referenced_message.author.username || 'unknown user';
          const referencedContent = messageData.referenced_message.content || 'message';
          conversationContext = `Previous message context: ${referencedAuthor}: "${referencedContent}" - User is replying to this message`;
          console.log(`💬 Adding context for reply to other user: ${conversationContext}`);
        }
      }
      
      // Enhanced logging for context
      if (conversationContext) {
        console.log(`🗣️ Conversation context built: ${conversationContext}`);
      } else {
        console.log(`💬 No conversation context - treating as new interaction`);
      }
      
      // **CRITICAL FIX**: Determine if this is a reply to bot (treat same as mention)
      const isReplyToBot = messageData.referenced_message && 
                          messageData.referenced_message.author && 
                          messageData.referenced_message.author.id === botClientId;
      
      console.log(`🎯 Message processing: Bot mentioned in content: ${/<@\!?(\d+)>/.test(messageData.content)}, Is reply to bot: ${isReplyToBot}`);
      
      // Use the EXACT local processing function with conversation context
      // **IMPORTANT**: Skip mention check for replies to bot (treat them as direct communication)
      const result = await processDiscordMessageWithAI(
        messageData.content,
        messageData.guild_id,
        messageData.channel_id,
        messageData.author.id,
        isReplyToBot, // skipMentionCheck = true for bot replies
        "user_2yMTRvIng7ljDfRRUlXFvQkWSb5", // authenticatedUserId
        conversationContext // ← NOW PASSING CONVERSATION CONTEXT!
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

// Get command mappings
app.get('/api/mappings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: mappings, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('user_id', decodedToken.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch command mappings' });
    }

    // Format response to match frontend expectations
    const formattedMappings = mappings.map(mapping => ({
      id: mapping.id,
      botId: mapping.bot_id,
      name: mapping.name,
      naturalLanguagePattern: mapping.natural_language_pattern,
      commandOutput: mapping.command_output,
      status: mapping.status || 'active',
      usageCount: mapping.usage_count || 0,
      createdAt: mapping.created_at
    }));

    res.json(formattedMappings);
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get individual command mapping
app.get('/api/mappings/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

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
      .eq('user_id', decodedToken.userId)
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
  } catch (error) {
    console.error('Individual mapping API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update individual command mapping
app.put('/api/mappings/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const { 
      name,
      naturalLanguagePattern,
      commandOutput,
      personalityContext,
      status 
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    const updateData = {};
    
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
      .eq('user_id', decodedToken.userId)
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
  } catch (error) {
    console.error('Update mapping API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete individual command mapping
app.delete('/api/mappings/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    // Delete mapping
    const { error: deleteError } = await supabase
      .from('command_mappings')
      .delete()
      .eq('id', id)
      .eq('user_id', decodedToken.userId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete mapping' });
    }

    return res.status(200).json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    console.error('Delete mapping API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add test and use endpoints for individual mappings
app.post('/api/mappings/:id/test', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const { testInput } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    if (!testInput) {
      return res.status(400).json({ error: 'Test input is required' });
    }

    // Get the mapping
    const { data: mapping, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('id', id)
      .eq('user_id', decodedToken.userId)
      .single();

    if (error || !mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    // Simple pattern matching for testing
    const pattern = mapping.natural_language_pattern.toLowerCase();
    const input = testInput.toLowerCase();
    
    // Basic pattern matching - check if input contains key words from pattern
    const patternWords = pattern.split(/\s+/).filter(word => word.length > 2);
    const inputWords = input.split(/\s+/);
    
    const matchedWords = patternWords.filter(patternWord => 
      inputWords.some(inputWord => inputWord.includes(patternWord) || patternWord.includes(inputWord))
    );
    
    const confidence = patternWords.length > 0 ? matchedWords.length / patternWords.length : 0;
    const isMatch = confidence > 0.5;

    return res.status(200).json({
      matched: isMatch,
      confidence: Math.round(confidence * 100),
      response: isMatch ? mapping.command_output : 'No match found',
      testInput,
      pattern: mapping.natural_language_pattern
    });
  } catch (error) {
    console.error('Mapping test API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/mappings/:id/use', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const { input, response } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    // Increment usage count
    const { data: currentMapping } = await supabase
      .from('command_mappings')
      .select('usage_count')
      .eq('id', id)
      .eq('user_id', decodedToken.userId)
      .single();

    const newUsageCount = (currentMapping?.usage_count || 0) + 1;

    const { data: updatedMapping, error: updateError } = await supabase
      .from('command_mappings')
      .update({ 
        usage_count: newUsageCount
      })
      .eq('id', id)
      .eq('user_id', decodedToken.userId)
      .select()
      .single();

    if (updateError || !updatedMapping) {
      console.error('Update error:', updateError);
      return res.status(404).json({ error: 'Failed to update mapping or mapping not found' });
    }

    return res.status(200).json({
      id: updatedMapping.id,
      usageCount: updatedMapping.usage_count,
      message: 'Mapping usage recorded successfully'
    });
  } catch (error) {
    console.error('Mapping use API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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