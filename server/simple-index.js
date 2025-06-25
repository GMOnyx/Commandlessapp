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
  // Present commands without technical output details - focus on natural patterns
  const commandList = availableCommands.map(cmd => 
    `- ID: ${cmd.id}, Name: ${cmd.name}, Natural Pattern: "${cmd.natural_language_pattern}"`
  ).join('\n');

  // Use provided personality context or generate a default one
  const personalityContext = botPersonality || 
    "You are a helpful conversational AI assistant that can handle any type of command and casual conversation. You're friendly, efficient, and excellent at understanding natural language for any task.";

  // Add conversation context if available
  const contextSection = conversationContext 
    ? `\n\nCONVERSATION CONTEXT:\n${conversationContext}\n\n**CONVERSATION HANDLING:**
- If user is replying to a previous bot message, consider the conversation flow
- Maintain context and provide relevant follow-up responses
- If the reply seems to be continuing a conversation rather than issuing a command, respond conversationally
- **IMPORTANT: Replies can also contain commands! Treat reply messages the same as mentioned messages for command detection**
- Look for conversational cues like "thanks", "ok", "got it", "what about", "also", "and", etc.
- But also look for command cues in any domain - moderation, utility, fun, music, economy, etc.\n`
    : '';

  return `${personalityContext}

**IMPORTANT CONTEXT:**
- You are a CONVERSATIONAL AI bot that understands natural language
- Users should talk to you normally, not use slash commands
- When explaining capabilities, show NATURAL LANGUAGE examples, not technical syntax
- Never show slash commands or {parameter} syntax to users

${contextSection}You are an advanced natural language processor for universal bot commands. Your job is to:
1. **Determine if the user wants to execute a command OR have casual conversation**
2. **Extract parameters aggressively and intelligently from natural language**
3. **Be decisive - execute commands when intent is clear, even with informal language**
4. **Handle ANY type of command: moderation, utility, fun, music, economy, information, custom workflows**

AVAILABLE COMMANDS:
${commandList}

🎯 **UNIVERSAL PARAMETER EXTRACTION MASTERY:**

**User References**: Extract user information from any mention format:
- "warn @username for spamming" → user: "username" 
- "give <@123456> admin role" → user: "123456"
- "check john's balance" → user: "john"
- "play music for everyone" → target: "everyone"

**Universal Natural Language Patterns**: Understand ANY phrasing for ANY command type:

**MODERATION:**
- "ban that user for trolling" → ban command
- "delete 5 messages please" → purge command  
- "give them a warning" → warn command

**UTILITY:**
- "remind me in 10 minutes" → reminder command
- "what's the weather like" → weather command
- "calculate 15% of 200" → math command

**FUN & ENTERTAINMENT:**
- "tell me a joke" → joke command
- "start a poll about pizza" → poll command
- "roll a dice" → random command

**MUSIC & MEDIA:**
- "play some chill music" → music play command
- "pause the song" → music pause command
- "what's playing now" → now playing command

**ECONOMY & GAMING:**
- "check my balance" → balance command
- "buy a sword from shop" → shop command
- "give user 100 coins" → pay command

**INFORMATION & SEARCH:**
- "look up cats on wikipedia" → search command
- "show server info" → server info command
- "get latest news" → news command

**Context-Aware Universal Extraction**: Look at the ENTIRE message for parameters:
- "nothing much just remind me about the meeting in 30 minutes" 
  → EXTRACT: message: "meeting", time: "30 minutes"
- "hey bot, when you have time, could you play that rock playlist"
  → EXTRACT: query: "rock playlist", action: "play"
- "can you tell everyone the event moved to 3pm tomorrow"
  → EXTRACT: message: "event moved to 3pm tomorrow", target: "everyone"

**Universal Semantic Understanding**: Map natural language to ANY command type:

**ACTION WORDS:**
- "play/start/begin" → play/start commands
- "stop/pause/halt" → stop/pause commands
- "show/display/get/find" → info/search commands
- "buy/purchase/get" → shop/economy commands
- "send/give/transfer" → payment/transfer commands
- "remind/alert/notify" → reminder commands
- "calculate/compute/math" → calculation commands
- "ban/remove/kick" → moderation commands
- "roll/random/pick" → random/chance commands

**PARAMETER TYPES:**
- **Time/Duration**: "in 5 minutes", "tomorrow", "next week", "30 seconds"
- **Amounts/Numbers**: "100 coins", "5 messages", "level 10", "50%"  
- **Content/Messages**: quoted text, implied messages, descriptions
- **Targets/Users**: @mentions, usernames, "everyone", "me", role names
- **Items/Objects**: "sword", "playlist", "channel", "role", specific items
- **Queries/Searches**: search terms, keywords, topics

🔥 **UNIVERSAL DECISION MAKING RULES:**

**EXECUTE IMMEDIATELY IF:**
- ✅ Clear action intent (ANY type: moderation, utility, fun, music, etc.)
- ✅ ANY required parameters can be extracted or reasonable defaults exist
- ✅ User mentions targets for social commands (give, send, check, etc.)
- ✅ Numbers/amounts found for quantity-based commands (buy, transfer, etc.)
- ✅ Content/queries found for information/entertainment commands
- ✅ Time expressions found for scheduling/reminder commands

**CASUAL CONVERSATION IF:**
- ❌ No action-related words or intent
- ❌ Pure greetings ("hi", "hello", "how are you", "wassup", "what's up")
- ❌ **HELP/CAPABILITY QUESTIONS**: "what can you do", "show commands", "list commands", "help me", "command list", "make a command list", etc.
- ❌ General chat without action words
- ❌ Conversational replies to previous bot messages ("thanks", "ok", "cool", "got it", "im great", "not much", "good", "fine")
- ❌ Follow-up questions about previous responses
- ❌ Emotional responses ("lol", "haha", "awesome", "nice", "wow")
- ❌ Short acknowledgments ("yes", "no", "sure", "maybe", "alright")

**KEY INSIGHT**: Questions about capabilities ("what can you do", "make a command list") = HELP REQUESTS = Conversational response with NATURAL LANGUAGE command examples, NOT executing commands!

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
      "user": "extracted_user_id_or_username",
      "reason": "complete reason text",
      "message": "complete message text",
      "amount": "number_as_string",
      "time": "time_expression",
      "query": "search_or_content_query",
      "target": "target_user_or_group",
      "item": "specific_item_or_object"
    }
  }
}
\`\`\`

**For CONVERSATION (no command intent):**
\`\`\`json
{
  "isCommand": false,
  "conversationalResponse": "friendly, helpful response that maintains conversation flow. For help requests, provide NATURAL LANGUAGE examples showing how to talk to the bot normally."
}
\`\`\`

**EXAMPLES OF UNIVERSAL CONVERSATION FLOW:**
- Reply to "wassup?" → "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎"
- Reply to "thanks" after command execution → "You're welcome! Happy to help. Anything else you need?"
- "what can you do?" → Show NATURAL examples: "Just talk to me normally! Like 'play some music', 'remind me in 5 minutes', 'ban @user for spam', 'what's the weather', etc."
- "help with commands" → Explain natural conversation approach with diverse examples

**EXAMPLES OF UNIVERSAL EXTRACTION:**
- "nothing much, just ban @user for spam" → EXECUTE ban immediately
- "can you play that chill playlist please" → EXECUTE music play immediately
- "remind me about the meeting in 30 minutes" → EXECUTE reminder immediately
- "what's 15% of 250" → EXECUTE calculation immediately
- "give john 100 coins for helping" → EXECUTE payment immediately
- "tell everyone the event is cancelled" → EXECUTE announcement immediately
- "yo bot, how's your ping?" → EXECUTE ping immediately
- "hi how are you doing?" → CASUAL conversation

⚡ **BE BOLD AND UNIVERSAL**: If you can extract ANY meaningful parameters and understand the intent FOR ANY TYPE OF COMMAND, EXECUTE it. Don't ask for clarification unless truly necessary!

Respond with valid JSON only:`;
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

    // **EXACT LOCAL IMPLEMENTATION**: Check for help requests BEFORE AI processing
    const lowerMessage = cleanMessage.toLowerCase();
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you do') || lowerMessage.includes('commands')) {
      console.log(`🎯 HELP REQUEST DETECTED: "${cleanMessage}" - Bypassing AI`);
      
      return {
        processed: true,
        conversationalResponse: `Hey! I'm a conversational AI that understands natural language - just talk to me normally! 🤖

Here are some examples of how to interact with me across different areas:

🛡️ **Moderation:** "ban @user for spam", "delete 5 messages", "warn them for being rude"

🎵 **Music & Fun:** "play some chill music", "tell me a joke", "roll a dice", "start a poll"

⚡ **Utility:** "remind me in 10 minutes", "what's the weather", "calculate 15% of 200"

💰 **Economy:** "check my balance", "give john 50 coins", "buy a sword from shop"

📊 **Info:** "show server stats", "what's my ping", "search for cats on wikipedia"

🔧 **Custom:** ${commands.length > 0 ? `Plus your configured commands like: ${commands.slice(0, 3).map(cmd => cmd.name).join(', ')}${commands.length > 3 ? ` and ${commands.length - 3} more` : ''}!` : 'Any workflows or commands your server has set up!'}

No need for slash commands or special syntax - I understand natural conversation! What would you like me to help with? 😊`
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