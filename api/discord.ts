import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// SOPHISTICATED AI PROCESSING FUNCTIONS (migrated from server/simple-index.js)

// Calculate semantic similarity between user input and command patterns
function calculateCommandSimilarity(userInput: string, command: any): number {
  const input = userInput.toLowerCase();
  let score = 0;
  
  // Extract command name from command output (e.g., "warn" from "/warn {user} {reason}")
  const commandName = extractCommandName(command.command_output);
  
  // 1. Direct command name match (highest weight)
  if (input.includes(commandName)) {
    score += 0.8;
  }
  
  // 2. Phrase-level pattern matching for natural language
  const phraseScore = calculatePhrasePatternScore(input, commandName);
  score += phraseScore * 0.7;
  
  // 3. Check natural language pattern similarity
  const pattern = command.natural_language_pattern.toLowerCase();
  const cleanPattern = pattern.replace(/\{[^}]+\}/g, '').trim();
  
  const inputWords = input.split(/\s+/);
  const patternWords = cleanPattern.split(/\s+/).filter(word => word.length > 2);
  
  const commonWords = inputWords.filter(word => 
    patternWords.some(pWord => 
      word.includes(pWord) || pWord.includes(word) || calculateSimilarity(word, pWord) > 0.7
    )
  );
  
  if (patternWords.length > 0) {
    score += (commonWords.length / patternWords.length) * 0.5;
  }
  
  // 4. Semantic keyword matching based on command type
  const semanticKeywords = generateSemanticKeywords(commandName);
  const keywordMatches = semanticKeywords.filter(keyword => input.includes(keyword));
  
  if (semanticKeywords.length > 0) {
    score += (keywordMatches.length / semanticKeywords.length) * 0.4;
  }
  
  return Math.min(score, 1.0);
}

// Calculate phrase-level pattern matching
function calculatePhrasePatternScore(input: string, commandName: string): number {
  const phrasePatterns = {
    'ban': ['ban', 'remove', 'kick out', 'get rid of', 'block'],
    'kick': ['kick', 'remove temporarily', 'boot'],
    'warn': ['warn', 'warning', 'caution', 'alert'],
    'mute': ['mute', 'silence', 'quiet'],
    'purge': ['purge', 'delete', 'clear', 'clean up', 'remove messages'],
    'say': ['say', 'announce', 'tell everyone', 'broadcast'],
    'ping': ['ping', 'test', 'check', 'latency', 'speed'],
    'help': ['help', 'commands', 'what can you do'],
    'channel': ['channel', 'info', 'details'],
    'server-info': ['server', 'guild', 'info', 'details']
  };
  
  const patterns = phrasePatterns[commandName] || [commandName];
  return patterns.some(pattern => input.includes(pattern)) ? 1.0 : 0.0;
}

// Calculate string similarity using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;
  
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
}

// Generate semantic keywords for command types
function generateSemanticKeywords(commandName: string): string[] {
  const keywordMap = {
    'ban': ['ban', 'remove', 'kick out', 'block', 'banish', 'exclude'],
    'kick': ['kick', 'boot', 'eject', 'remove temporarily'],
    'warn': ['warn', 'warning', 'caution', 'alert', 'notify'],
    'mute': ['mute', 'silence', 'quiet', 'shush'],
    'purge': ['purge', 'delete', 'clear', 'clean', 'remove messages', 'bulk delete'],
    'say': ['say', 'announce', 'broadcast', 'tell', 'message'],
    'ping': ['ping', 'test', 'check', 'latency', 'response time'],
    'help': ['help', 'commands', 'assistance', 'guide'],
    'channel': ['channel', 'room', 'chat'],
    'server-info': ['server', 'guild', 'info', 'details', 'stats']
  };
  
  return keywordMap[commandName] || [commandName];
}

// Extract command name from command output
function extractCommandName(commandOutput: string): string {
  if (!commandOutput) return '';
  
  // Remove leading slash and extract first word
  const cleaned = commandOutput.replace(/^\//, '');
  const firstWord = cleaned.split(' ')[0];
  
  // Remove any parameter placeholders
  return firstWord.replace(/\{[^}]+\}/g, '').trim();
}

// Check if input is purely conversational
function isConversationalInput(input: string): boolean {
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
    /^nothing much[\s,].*$/i,
    /^(great|good|fine|awesome|excellent)\s+(thanks?|thank you)[\s!]*$/i,
    /^(thanks?|thank you)\s+(for\s+.+)?$/i,
    /^(sounds?\s+good|sounds?\s+great|sounds?\s+awesome)[\s!]*$/i,
    /^(that's?\s+)?(cool|nice|great|awesome|perfect)[\s!]*$/i
  ];
  
  return conversationalPatterns.some(pattern => pattern.test(input.trim()));
}

// Advanced parameter extraction from user input and pattern
function extractParametersFromPattern(userInput: string, naturalLanguagePattern: string, mentionedUserIds: string[] = []): Record<string, string> {
  const extractedParams: Record<string, string> = {};
  
  // Extract Discord user mentions
  if (mentionedUserIds && mentionedUserIds.length > 0) {
    extractedParams.user = mentionedUserIds[0];
  }
  
  // Extract user mentions from text
  const userMentionMatch = userInput.match(/<@!?(\d+)>/);
  if (userMentionMatch) {
    extractedParams.user = userMentionMatch[1];
  }
  
  // Extract username mentions
  const usernameMatch = userInput.match(/@(\w+)/);
  if (usernameMatch) {
    extractedParams.username = usernameMatch[1];
  }
  
  // Extract reason with multiple patterns
  const reasonPatterns = [
    /\bfor\s+(.+?)(?:\s+(?:and|but|however|also)|$)/i,
    /\bbecause\s+(.+?)(?:\s+(?:and|but|however|also)|$)/i,
    /\breason:?\s*(.+?)(?:\s+(?:and|but|however|also)|$)/i,
    /\b(?:due to|since)\s+(.+?)(?:\s+(?:and|but|however|also)|$)/i
  ];
  
  for (const pattern of reasonPatterns) {
    const reasonMatch = userInput.match(pattern);
    if (reasonMatch && reasonMatch[1] && reasonMatch[1].trim()) {
      extractedParams.reason = reasonMatch[1].trim();
      break;
    }
  }
  
  // Extract numbers for amounts/duration
  const numberMatch = userInput.match(/(\d+)/);
  if (numberMatch) {
    const number = numberMatch[1];
    if (naturalLanguagePattern.includes('{amount}')) {
      extractedParams.amount = number;
    }
    if (naturalLanguagePattern.includes('{duration}')) {
      extractedParams.duration = number + 'm';
    }
  }
  
  // Extract quoted text for messages
  const quotedMatch = userInput.match(/"([^"]+)"/);
  if (quotedMatch) {
    extractedParams.message = quotedMatch[1];
  }
  
  // Extract message content for say command
  if (naturalLanguagePattern.includes('{message}')) {
    const sayMatch = userInput.match(/say\s+(.*)/i);
    if (sayMatch) {
      extractedParams.message = sayMatch[1];
    }
  }
  
  return extractedParams;
}

// SOPHISTICATED AI PROCESSING WITH GEMINI (exact copy from server/simple-index.js)
async function processWithAI(cleanMessage: string, commandMappings: any[], message: any, userId: string, conversationContext: string = ''): Promise<any> {
  try {
    const model = genAI!.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Create a comprehensive prompt for command analysis
    const commandList = commandMappings.map(cmd => 
      `- ID: ${cmd.id}, Name: ${cmd.name}, Pattern: "${cmd.natural_language_pattern}" → ${cmd.command_output}`
    ).join('\n');

    // SOPHISTICATED PROMPT (exact copy from your server code)
    const prompt = `You are an advanced natural language processor for Discord bot commands. Your job is to:
1. **Determine if the user wants to execute a command OR have casual conversation**
2. **Extract parameters aggressively and intelligently from natural language**
3. **Be decisive - execute commands when intent is clear, even with informal language**
4. **Maintain conversational flow when user is replying to previous bot messages**

AVAILABLE COMMANDS:
${commandList}

${conversationContext ? `
🗣️ **CONVERSATION CONTEXT:**
${conversationContext}

**CONVERSATION HANDLING:**
- If user is replying to a previous bot message, consider the conversation flow
- Maintain context and provide relevant follow-up responses
- If the reply seems to be continuing a conversation rather than issuing a command, respond conversationally
- **IMPORTANT: Replies can also contain commands! Treat reply messages the same as mentioned messages for command detection**
- Look for conversational cues like "thanks", "ok", "got it", "what about", "also", "and", etc.
- But also look for command cues like "ban", "kick", "warn", "purge", "say", etc. even in replies

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
- ❌ Conversational replies to previous bot messages ("thanks", "ok", "cool", "got it", "im great", "not much", "good", "fine")
- ❌ Follow-up questions about previous responses
- ❌ Emotional responses ("lol", "haha", "awesome", "nice", "wow")
- ❌ Short acknowledgments ("yes", "no", "sure", "maybe", "alright")

**CONFIDENCE SCORING:**
- 90-100: Perfect match with all parameters extracted
- 80-89: Clear intent with most important parameters
- 70-79: Good intent with some parameters (STILL EXECUTE)
- 60-69: Likely intent but may need minor clarification
- Below 60: Ask for clarification only if truly ambiguous

USER MESSAGE: "${cleanMessage}"

CONTEXT: ${conversationContext || 'User mentioned me in Discord. Extract any mentioned users, numbers, or quoted text.'}

` : ''}
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
  "conversationalResponse": "friendly, helpful response that maintains conversation flow and references previous context when appropriate"
}
\`\`\`

**EXAMPLES OF CONVERSATION FLOW:**
- Reply to "wassup?" → "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎"
- Reply to "thanks" after command execution → "You're welcome! Happy to help. Anything else you need?"

**EXAMPLES OF AGGRESSIVE EXTRACTION:**
- "nothing much, just ban <@560079402013032448> for spam" → EXECUTE ban immediately
- "can you please delete like 10 messages" → EXECUTE purge immediately
- "tell everyone the event is cancelled" → EXECUTE say immediately
- "yo bot, how's your ping?" → EXECUTE ping immediately
- "hi how are you doing?" → CASUAL conversation

⚡ **BE BOLD**: If you can extract ANY meaningful parameters and understand the intent, EXECUTE the command. Don't ask for clarification unless truly necessary!

Respond with valid JSON only:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiResponse = response.text().trim();
    
    console.log('🤖 SOPHISTICATED AI Response:', aiResponse);
    
    // Parse AI response
    let parsed;
    try {
      // Extract JSON from response if it's wrapped in text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return {
        success: true,
        response: "Hey! I'm here and ready to help. What's going on?"
      };
    }

    if (parsed.isCommand && parsed.bestMatch && parsed.bestMatch.commandId) {
      // Find the matching command by ID
      const matchedCommand = commandMappings.find(cmd => cmd.id === parsed.bestMatch.commandId);
      
      if (matchedCommand) {
        // Enhanced parameter extraction
        const mentionedUserIds = [];
        if (message.mentions && message.mentions.length > 0) {
          message.mentions.forEach(user => mentionedUserIds.push(user.id));
        }
        
        // Merge AI extracted parameters with advanced parameter extraction
        const aiParams = parsed.bestMatch.params || {};
        const advancedParams = extractParametersFromPattern(cleanMessage, matchedCommand.natural_language_pattern, mentionedUserIds);
        
        // Combine parameters, prioritizing AI extraction but filling gaps with advanced extraction
        const finalParams = { ...advancedParams, ...aiParams };
        
        // Add Discord-specific parameter extraction
        if (message.mentions && message.mentions.length > 0) {
          const firstMention = message.mentions[0];
          finalParams.user = finalParams.user || firstMention.id;
          finalParams.username = finalParams.username || firstMention.username;
        }

        let commandOutput = matchedCommand.command_output;
        
        // Replace parameters in the output
        for (const [key, value] of Object.entries(finalParams)) {
          if (value && value.toString().trim()) {
            commandOutput = commandOutput.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
          }
        }
        
        // Replace any remaining placeholders with defaults
        commandOutput = commandOutput.replace(/\{reason\}/g, 'No reason provided');
        commandOutput = commandOutput.replace(/\{message\}/g, 'No message provided');
        commandOutput = commandOutput.replace(/\{amount\}/g, '1');
        commandOutput = commandOutput.replace(/\{duration\}/g, '5m');
        commandOutput = commandOutput.replace(/\{user\}/g, 'target user');

        // Log the command usage
        await supabase
          .from('command_mappings')
          .update({ 
            usage_count: (matchedCommand.usage_count || 0) + 1 
          })
          .eq('id', matchedCommand.id);

        // For now, return a sophisticated response
        // TODO: Add actual Discord command execution
        
        return {
          success: true,
          response: `🎯 **SOPHISTICATED AI EXECUTED**: "${matchedCommand.name}" command detected with ${parsed.bestMatch.confidence}% confidence!\n\n**Command**: ${commandOutput}\n**Parameters**: ${JSON.stringify(finalParams)}\n\n*Your sophisticated AI system is now working! Next: Adding real Discord command execution.*`
        };
      }
    }

    // Conversational response with enhanced personality
    let conversationalResponse = parsed.conversationalResponse;
    
    // Add some personality to common responses
    if (!conversationalResponse) {
      const lowerMessage = cleanMessage.toLowerCase();
      
      if (lowerMessage.includes('wassup') || lowerMessage.includes('what\'s up') || lowerMessage.includes('whats up')) {
        conversationalResponse = "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎";
      } else if (lowerMessage.includes('how') && (lowerMessage.includes('going') || lowerMessage.includes('doing'))) {
        conversationalResponse = "I'm doing great! Running smooth and ready for action. How about you? Need help with anything? 🚀";
      } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        conversationalResponse = "Hello! I'm your AI Discord bot with sophisticated processing. You can give me natural language commands and I'll execute them intelligently.";
      } else if (lowerMessage.includes('help')) {
        const commandNames = commandMappings.map(cmd => cmd.name).slice(0, 5);
        conversationalResponse = `I can help with these commands: ${commandNames.join(', ')}. Try using natural language like "ban @user for spam" or "delete 10 messages"!`;
      } else {
        conversationalResponse = "Hey! What's up? I'm here with sophisticated AI and ready to help with whatever you need!";
      }
    }

    return {
      success: true,
      response: conversationalResponse
    };

  } catch (aiError) {
    console.error('Sophisticated AI processing failed:', aiError);
    return {
      success: true,
      response: "Sorry, I encountered an error with my sophisticated AI processing. Please try again!"
    };
  }
}

// MAIN MESSAGE PROCESSING (updated to use sophisticated systems)
async function processMessageWithAI(
  messageContent: string, 
  botId: string, 
  userId: string, 
  message: any
): Promise<{
  response: string;
  shouldExecute: boolean;
  command?: string;
}> {
  try {
    console.log(`🚀 SOPHISTICATED PROCESSING: "${messageContent}" for bot ${botId}`);
    
    // Clean the message content (remove bot mentions)
    let cleanMessage = messageContent.replace(/<@!?\d+>/g, '').trim();
    
    if (!cleanMessage) {
      return {
        response: "Hello! How can I help you today? I can help with moderation commands or just chat!",
        shouldExecute: false
      };
    }

    // Get command mappings for this user
    const { data: commandMappings, error: mappingsError } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (mappingsError) {
      console.error('Error fetching command mappings:', mappingsError);
      return {
        response: "I'm here to help! I had trouble accessing my commands, but I'm ready to chat.",
        shouldExecute: false
      };
    }

    if (!commandMappings || commandMappings.length === 0) {
      return {
        response: "Hi there! I don't have any commands configured yet, but I'm happy to chat!",
        shouldExecute: false
      };
    }

    // Use sophisticated AI processing if available
    if (genAI) {
      const result = await processWithAI(cleanMessage, commandMappings, message, userId, '');
      return {
        response: result.response,
        shouldExecute: result.success
      };
    } else {
      return {
        response: "Hi! My sophisticated AI isn't available right now, but I'm still here to help!",
        shouldExecute: false
      };
    }

  } catch (error) {
    console.error('Error in sophisticated message processing:', error);
    return {
      response: "Sorry, I encountered an error processing your message. Please try again!",
      shouldExecute: false
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    let messageContent = '';
    let botId = '';
    let userId = '';
    let message: any = {};

    // Handle Universal Relay Service format vs standard format
    if (body.message && typeof body.message === 'object' && body.message.content) {
      // Universal Relay Service format
      messageContent = body.message.content;
      botId = body.botClientId || 'unknown';
      userId = body.message.author?.id || 'unknown';
      message = body.message;
      
      console.log(`📨 SOPHISTICATED API (URS): Processing "${messageContent}" for bot ${botId}`);
      
      const result = await processMessageWithAI(messageContent, botId, userId, message);
      
      // Return response in Universal Relay Service expected format
      return res.status(200).json({
        processed: true,
        response: result.response,
        execution: null
      });
      
    } else if (body.action === 'process-message') {
      // Standard format
      messageContent = body.message;
      botId = body.botId;
      userId = body.userId;
      
      console.log(`📨 SOPHISTICATED API (Standard): Processing "${messageContent}" for bot ${botId}`);
      
      const result = await processMessageWithAI(messageContent, botId, userId, {});
      
      return res.status(200).json({
        success: true,
        response: result.response,
        shouldExecute: result.shouldExecute,
        command: result.command || null
      });
    }

    return res.status(400).json({ error: 'Invalid message format' });
  } catch (error) {
    console.error('Error in sophisticated API handler:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      response: "Sorry, I encountered an error. Please try again."
    });
  }
}
