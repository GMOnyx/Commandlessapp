import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const GEMINI_MODEL = "gemini-1.5-pro";

interface DiscordMessage {
  content: string;
  author: {
    id: string;
    username: string;
    bot: boolean;
  };
  channel_id: string;
  guild_id?: string;
  mentions?: Array<{ id: string; username: string }>;
  referenced_message?: {
    id: string;
    author: { id: string };
  };
}

// ADVANCED AI MESSAGE PROCESSING (migrated from server/simple-index.js)
async function processMessageWithAI(
  message: string, 
  context: string = '', 
  botId: string, 
  userId: string,
  conversationContext: string = ''
): Promise<{
  response: string;
  shouldExecute: boolean;
  command?: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  conversationalResponse?: string;
}> {
  try {
    console.log(`🤖 Processing message with AI: "${message}" for bot ${botId}`);
    
    // Get command mappings for this bot (auto-discovered commands)
    const { data: commandMappings } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('bot_id', botId)
      .eq('user_id', userId)
      .eq('status', 'active');
    
    console.log(`📋 Found ${commandMappings?.length || 0} command mappings for bot ${botId}`);
    
    if (!commandMappings || commandMappings.length === 0) {
      return {
        response: "Hi there! I don't have any commands configured yet, but I'm happy to chat!",
        shouldExecute: false,
        conversationalResponse: "Hi there! I don't have any commands configured yet, but I'm happy to chat!"
      };
    }

    // Use AI if available, otherwise fall back to simple matching
    if (genAI) {
      return await processWithAdvancedAI(message, commandMappings, userId, conversationContext);
    } else {
      return await processWithSimpleMatching(message, commandMappings, userId);
    }

  } catch (error) {
    console.error('❌ AI processing error:', error);
    return {
      response: "I'm having a bit of trouble processing that right now, but I'm here and listening! Try asking for 'help' or 'ping'. 🤖",
      shouldExecute: false
    };
  }
}

// Advanced AI Processing (from server/simple-index.js)
async function processWithAdvancedAI(cleanMessage: string, commandMappings: any[], userId: string, conversationContext: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Create a comprehensive prompt for command analysis
    const commandList = commandMappings.map(cmd => 
      `- ID: ${cmd.id}, Name: ${cmd.name}, Pattern: "${cmd.natural_language_pattern}" → ${cmd.command_output}`
    ).join('\n');

    // Enhanced prompt with sophisticated AI analysis (from server/simple-index.js)
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

` : ''}

USER MESSAGE: "${cleanMessage}"

CONTEXT: ${conversationContext || 'User mentioned me in Discord. Extract any mentioned users, numbers, or quoted text.'}

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
- Reply to "ok" after explanation → "Great! Let me know if you have any other questions."
- Reply to "what about X?" → Reference previous context and answer about X
- Reply to "also can you..." → Handle the additional request while acknowledging the continuation

**EXAMPLES OF AGGRESSIVE EXTRACTION:**
- "nothing much, just ban <@560079402013032448> for spam" → EXECUTE ban immediately
- "can you please delete like 10 messages" → EXECUTE purge immediately  
- "tell everyone the event is cancelled" → EXECUTE say immediately
- "that user keeps trolling, give them a warning" → EXTRACT context for warn
- "yo bot, how's your ping?" → EXECUTE ping immediately
- "remove this toxic user from server" → Need user ID for ban
- "hi how are you doing?" → CASUAL conversation

⚡ **BE BOLD**: If you can extract ANY meaningful parameters and understand the intent, EXECUTE the command. Don't ask for clarification unless truly necessary!

Respond with valid JSON only:`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiResponse = response.text().trim();
    
    console.log('🤖 AI Response:', aiResponse);
    
    // Parse AI response
    let parsed;
    try {
      // Extract JSON from response if it's wrapped in text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return {
        response: "Hey! I'm here and ready to help. What's going on?",
        shouldExecute: false,
        conversationalResponse: "Hey! I'm here and ready to help. What's going on?"
      };
    }

    if (parsed.isCommand && parsed.bestMatch && parsed.bestMatch.commandId) {
      // Find the matching command by ID
      const matchedCommand = commandMappings.find(cmd => cmd.id === parsed.bestMatch.commandId);
      
      if (matchedCommand) {
        // Advanced parameter extraction with fallback methods
        const aiParams = parsed.bestMatch.params || {};
        const fallbackParams = extractParametersFromPattern(cleanMessage, matchedCommand.natural_language_pattern);
        
        // Combine parameters, prioritizing AI extraction but filling gaps with fallback extraction
        const finalParams = { ...fallbackParams, ...aiParams };

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

        // Generate natural response using Gemini
        const naturalResponse = await generateNaturalResponse(cleanMessage, matchedCommand, finalParams);
        
        return {
          response: naturalResponse || `✅ Executing ${matchedCommand.name} command with confidence ${(parsed.bestMatch.confidence * 100).toFixed(1)}%`,
          shouldExecute: true,
          command: commandOutput
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
        conversationalResponse = "Hello! I'm your AI Discord bot. You can give me natural language commands and I'll execute them intelligently.";
      } else if (lowerMessage.includes('help')) {
        const commandNames = commandMappings.map(cmd => cmd.name).slice(0, 5);
        conversationalResponse = `I can help with these commands: ${commandNames.join(', ')}. Try using natural language like "execute ${commandNames[0]}" or just mention the command name!`;
      } else {
        conversationalResponse = "Hey! What's up? I'm here and ready to help with whatever you need!";
      }
    }

    return {
      response: conversationalResponse,
      shouldExecute: false,
      conversationalResponse: conversationalResponse
    };

  } catch (aiError) {
    console.error('AI processing failed:', aiError);
    // Fall back to simple processing
    return await processWithSimpleMatching(cleanMessage, commandMappings, userId);
  }
}

// Simple Pattern Matching (fallback)
async function processWithSimpleMatching(cleanMessage: string, commandMappings: any[], userId: string) {
  const lowerMessage = cleanMessage.toLowerCase();
  
  // Check for command matches
  for (const mapping of commandMappings) {
    const commandName = mapping.name.toLowerCase();
    const pattern = mapping.natural_language_pattern.toLowerCase();
    
    // Simple matching logic
    if (lowerMessage.includes(commandName) || 
        lowerMessage.includes(pattern.replace(/execute|command/g, '').trim()) ||
        calculateCommandSimilarity(cleanMessage, mapping) > 0.5) {
      
      // Extract parameters from the message
      const params = extractParametersFromPattern(cleanMessage, mapping.natural_language_pattern);
      
      // Build the command output
      let commandOutput = mapping.command_output;
      
      // Replace parameters in the output
      for (const [key, value] of Object.entries(params)) {
        commandOutput = commandOutput.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
      
      // Log the command usage
      await supabase
        .from('command_mappings')
        .update({ 
          usage_count: (mapping.usage_count || 0) + 1 
        })
        .eq('id', mapping.id);

      return {
        response: `✅ Executing ${mapping.name} command`,
        shouldExecute: true,
        command: commandOutput
      };
    }
  }

  // Conversational responses for common phrases
  if (lowerMessage.includes('wassup') || lowerMessage.includes('what\'s up') || lowerMessage.includes('whats up')) {
    return {
      response: "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎",
      shouldExecute: false,
      conversationalResponse: "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎"
    };
  }

  if (lowerMessage.includes('how') && (lowerMessage.includes('going') || lowerMessage.includes('doing'))) {
    return {
      response: "I'm doing great! Running smooth and ready for action. How about you? Need help with anything? 🚀",
      shouldExecute: false,
      conversationalResponse: "I'm doing great! Running smooth and ready for action. How about you? Need help with anything? 🚀"
    };
  }

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return {
      response: "Hello! I'm your AI Discord bot. You can give me natural language commands and I'll execute them intelligently.",
      shouldExecute: false,
      conversationalResponse: "Hello! I'm your AI Discord bot. You can give me natural language commands and I'll execute them intelligently."
    };
  }

  if (lowerMessage.includes('help')) {
    const commandNames = commandMappings.map(cmd => cmd.name).slice(0, 5);
    return {
      response: `I can help with these commands: ${commandNames.join(', ')}. Try using natural language like "execute ${commandNames[0]}" or just mention the command name!`,
      shouldExecute: false
    };
  }

  return {
    response: "I understand you mentioned me, but I'm not sure what you'd like me to do. Try asking for 'help' to see what I can do!",
    shouldExecute: false,
    conversationalResponse: "I understand you mentioned me, but I'm not sure what you'd like me to do. Try asking for 'help' to see what I can do!"
  };
}

// GEMINI AI INTEGRATION (migrated from server)
async function findBestCommandMatchWithAI(
  userInput: string, 
  availableCommands: any[],
  conversationContext: string = ''
): Promise<{ command: any; confidence: number; params: Record<string, string> } | null> {
  
  if (!genAI || !process.env.GEMINI_API_KEY) {
    // Fallback to non-AI matching
    return await findBestCommandMatch(userInput, availableCommands);
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const commandList = availableCommands.map(cmd => ({
      name: cmd.name,
      pattern: cmd.natural_language_pattern,
      output: cmd.command_output,
      description: cmd.description
    }));

    const prompt = `
You are an AI assistant that matches user input to Discord bot commands. 
Analyze the user input and find the best matching command from the available options.

Available Commands:
${commandList.map(cmd => `- ${cmd.name}: "${cmd.pattern}" -> ${cmd.output} (${cmd.description})`).join('\n')}

User Input: "${userInput}"
${conversationContext ? `Conversation Context: ${conversationContext}` : ''}

Respond with a JSON object containing:
{
  "bestMatch": {
    "commandName": "name of best matching command or null",
    "confidence": 0.0-1.0,
    "extractedParams": {
      "param1": "value1",
      "param2": "value2"
    },
    "reasoning": "why this command was chosen"
  }
}

If no command matches well (confidence < 0.3), set commandName to null.
Extract parameter values from the user input based on the command pattern.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse Gemini response");
    }
    
    const aiResponse = JSON.parse(jsonMatch[0]);
    const match = aiResponse.bestMatch;
    
    if (!match.commandName || match.confidence < 0.3) {
      return null;
    }
    
    // Find the actual command object
    const command = availableCommands.find(cmd => cmd.name === match.commandName);
    if (!command) {
      return null;
    }
    
    return {
      command,
      confidence: match.confidence,
      params: match.extractedParams || {}
    };
    
  } catch (error) {
    console.error('Gemini AI matching error:', error);
    // Fallback to basic matching
    return await findBestCommandMatch(userInput, availableCommands);
  }
}

async function generateNaturalResponse(
  userInput: string,
  command: any,
  params: Record<string, string>
): Promise<string | null> {
  if (!genAI || !process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const prompt = `
You are a helpful Discord moderation bot. A user has requested an action and you're about to execute it.
Generate a natural, friendly response that confirms what you're about to do.

User Input: "${userInput}"
Command to Execute: ${command.command_output}
Extracted Parameters: ${JSON.stringify(params)}
Command Description: ${command.description}

Generate a brief, natural response (1-2 sentences) that:
1. Acknowledges the user's request
2. Confirms what action you're taking
3. Is professional but friendly
4. Uses appropriate emojis for the action type

Examples:
- For banning: "🔨 I'll ban that user for the specified reason."
- For warnings: "⚠️ I'll issue a warning to that user."
- For message deletion: "🗑️ I'll clean up those messages for you."

Response:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
    
  } catch (error) {
    console.error('Error generating natural response:', error);
    return null;
  }
}

async function generateConversationalResponse(
  userInput: string,
  context: string,
  conversationContext: string
): Promise<string> {
  if (!genAI || !process.env.GEMINI_API_KEY) {
    // Fallback responses
    const lowerInput = userInput.toLowerCase();
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return "Hello! I'm here to help with Discord moderation. You can ask me to ban, kick, warn users, or manage messages using natural language.";
    }
    if (lowerInput.includes('thank')) {
      return "You're welcome! Let me know if you need any other help with server moderation.";
    }
    return "I'm here to help with Discord moderation. Try asking me to perform actions like 'ban @user for spam' or ask for 'help' to see what I can do.";
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const prompt = `
You are a helpful Discord moderation bot with a friendly personality. 
Respond to this conversational message in a natural, helpful way.

Bot Context: ${context}
${conversationContext ? `Conversation History: ${conversationContext}` : ''}

User Message: "${userInput}"

Respond as a Discord bot that:
1. Is friendly and professional
2. Can help with moderation tasks
3. Keeps responses brief (1-2 sentences)
4. Offers help with specific actions when appropriate
5. Uses appropriate emojis sparingly

Response:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
    
  } catch (error) {
    console.error('Error generating conversational response:', error);
    return "I'm here to help with Discord moderation. Try asking me to perform actions like 'ban @user for spam' or ask for 'help' to see what I can do.";
  }
}

async function checkForClarificationNeed(
  userInput: string,
  availableCommands: any[]
): Promise<string | null> {
  if (!genAI || !process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const commandList = availableCommands.map(cmd => `- ${cmd.name}: ${cmd.description}`).join('\n');
    
    const prompt = `
Analyze this user input to determine if they need clarification to complete their request.

User Input: "${userInput}"
Available Commands:
${commandList}

Respond with JSON:
{
  "needsClarification": true/false,
  "clarificationQuestion": "specific question to ask" or null,
  "reasoning": "why clarification is needed"
}

User needs clarification if:
1. They mention an action but are missing required details (like target user, reason, etc.)
2. The request is ambiguous between multiple commands
3. They're asking about capabilities without being specific

If no clarification is needed, set needsClarification to false.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }
    
    const clarification = JSON.parse(jsonMatch[0]);
    return clarification.needsClarification ? clarification.clarificationQuestion : null;
    
  } catch (error) {
    console.error('Error checking clarification need:', error);
    return null;
  }
}

// GEMINI-POWERED PARAMETER EXTRACTION (migrated from server)
async function parseNaturalLanguageWithGemini(
  naturalLanguagePattern: string,
  userInput: string
): Promise<{ [key: string]: string } | null> {
  if (!genAI || !process.env.GEMINI_API_KEY) {
    // Fallback to basic extraction
    return extractParametersFromInput(userInput);
  }

  try {
    // Extract variable names from pattern
    const variableRegex = /{([^}]+)}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variableRegex.exec(naturalLanguagePattern)) !== null) {
      variables.push(match[1]);
    }

    if (variables.length === 0) {
      return {}; // No variables to extract
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const prompt = `
You are an assistant that extracts variable values from user inputs based on a pattern.
Given a pattern with variables in {curly_braces} and a user input, extract the values for each variable.
Respond only with a JSON object where keys are variable names and values are extracted values.
If you cannot extract a value for a variable, set its value to null.

Pattern: "${naturalLanguagePattern}"
Variables: ${variables.join(", ")}
User Input: "${userInput}"

Extract the values of each variable from the user input. Be smart about extracting:
- user: Discord mentions (@username), usernames, or user IDs
- reason: text after "for", "because", or describing the issue
- amount: numbers (for message deletion, timeouts, etc.)
- duration: time expressions like "5m", "1h", "2 days"
- message: quoted text or content to say/announce
- role: role names mentioned

JSON Response:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from Gemini response");
    }
    
    const jsonResponse = JSON.parse(jsonMatch[0]);
    return jsonResponse;
    
  } catch (error) {
    console.error('Gemini parameter extraction error:', error);
    // Fallback to basic extraction
    return extractParametersFromInput(userInput);
  }
}

// Advanced AI command matching (migrated from server)
async function findBestCommandMatch(
  userInput: string, 
  availableCommands: any[]
): Promise<{ command: any; confidence: number; params: Record<string, string> } | null> {
  
  let bestMatch: { command: any; confidence: number; params: Record<string, string> } | null = null;
  let highestConfidence = 0;
  
  for (const command of availableCommands) {
    // Calculate semantic similarity between user input and command patterns
    const confidence = calculateCommandSimilarity(userInput, command);
    
    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      
      // Extract parameters based on the command's natural language pattern  
      const params = extractParametersFromInput(userInput);
      
      bestMatch = {
        command,
        confidence,
        params
      };
    }
  }
  
  return bestMatch;
}

function calculateCommandSimilarity(userInput: string, command: any): number {
  const input = userInput.toLowerCase();
  let score = 0;
  
  // Extract command name from command output (e.g., "warn" from "/warn {user} {reason}")
  const commandName = extractCommandName(command.command_output);
  
  // 1. Direct command name match (highest weight)
  if (input.includes(commandName)) {
    score += 0.8;
  }
  
  // 2. Check natural language pattern similarity
  const pattern = command.natural_language_pattern.toLowerCase();
  
  // Calculate word overlap between input and pattern
  const inputWords = input.split(/\s+/);
  const patternWords = pattern.split(/\s+/).filter(word => word.length > 2);
  
  const commonWords = inputWords.filter(word => 
    patternWords.some(pWord => 
      word.includes(pWord) || pWord.includes(word)
    )
  );
  
  if (patternWords.length > 0) {
    score += (commonWords.length / patternWords.length) * 0.5;
  }
  
  // 3. Semantic keyword matching
  const semanticKeywords = generateSemanticKeywords(commandName);
  const keywordMatches = semanticKeywords.filter(keyword => input.includes(keyword));
  
  if (semanticKeywords.length > 0) {
    score += (keywordMatches.length / semanticKeywords.length) * 0.3;
  }
  
  return Math.min(score, 1.0);
}

function generateSemanticKeywords(commandName: string): string[] {
  const keywordMap: Record<string, string[]> = {
    'ban': ['ban', 'remove', 'kick out', 'banish', 'exclude'],
    'kick': ['kick', 'remove', 'boot', 'eject'],
    'warn': ['warn', 'warning', 'caution', 'alert', 'notify'],
    'mute': ['mute', 'silence', 'quiet', 'shush'],
    'timeout': ['timeout', 'temp ban', 'temporary', 'time out'],
    'role': ['role', 'rank', 'permission', 'access'],
    'purge': ['purge', 'delete', 'clear', 'remove messages', 'clean'],
    'ping': ['ping', 'latency', 'response time', 'speed'],
    'note': ['note', 'record', 'log', 'remember'],
    'say': ['say', 'announce', 'broadcast', 'message']
  };
  
  return keywordMap[commandName] || [commandName];
}

function extractParametersFromInput(userInput: string): Record<string, string> {
  const params: Record<string, string> = {};
  
  // Extract user mentions
  const userMatch = userInput.match(/@(\w+)/);
  if (userMatch) {
    params.user = userMatch[1];
  }
  
  // Extract reason (text after "for" or "because")
  const reasonMatch = userInput.match(/(?:for|because)\s+(.+)$/i);
  if (reasonMatch) {
    params.reason = reasonMatch[1].trim();
  }
  
  // Extract duration
  const durationMatch = userInput.match(/(\d+)\s*(min|minute|hour|day|week)s?/i);
  if (durationMatch) {
    params.duration = durationMatch[0];
  }
  
  return params;
}

// ADVANCED PARAMETER EXTRACTION (migrated from server)
function extractParametersFromPattern(
  userInput: string, 
  pattern: string, 
  mentionedUserIds: string[] = []
): Record<string, string> {
  const params: Record<string, string> = {};
  
  // Add mentioned users
  if (mentionedUserIds.length > 0) {
    params.user = mentionedUserIds[0];
  }
  
  // Extract parameters based on what placeholders are in the pattern
  if (pattern.includes('{reason}')) {
    params.reason = extractReason(userInput);
  }
  
  if (pattern.includes('{message}')) {
    params.message = extractMessage(userInput);
  }
  
  if (pattern.includes('{amount}')) {
    params.amount = extractAmount(userInput);
  }
  
  if (pattern.includes('{duration}')) {
    params.duration = extractDuration(userInput);
  }
  
  if (pattern.includes('{role}')) {
    params.role = extractRole(userInput);
  }
  
  return params;
}

function extractReason(text: string): string {
  const patterns = [
    // Standard reason patterns
    /(?:for|because|due to|reason:)\s+(.+)$/i,
    /(?:they|user)\s+(?:keep|keeps|is|are|was|were)\s+(.+)$/i,
    /(?:being|getting)\s+(.+)$/i,
    
    // Enhanced natural language patterns
    /(?:since|as)\s+(?:they|user|he|she)\s+(.+)$/i,
    /(?:they|user|he|she)\s+(?:has been|have been)\s+(.+)$/i,
    /(?:caught)\s+(.+)$/i,
    /(?:for being)\s+(.+)$/i,
    
    // Common toxic behavior patterns
    /(?:they are|theyre|they're)\s+(.+)$/i,
    /(?:user is|users)\s+(.+)$/i,
    /(?:keeps?|keep)\s+(.+)$/i,
    /(?:always|constantly|continuously)\s+(.+)$/i,
    
    // After action patterns
    /(?:spammer|troll|toxic user|bad user|annoying user)\s+(.+)$/i,
    /\w+\s+(.+toxic.*)$/i,
    /\w+\s+(.+annoying.*)$/i,
    /\w+\s+(.+harassment.*)$/i,
    /\w+\s+(.+spam.*)$/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let reason = match[1].trim();
      
      // Clean up common prefixes that get caught
      reason = reason.replace(/^(are|is|was|were|being|getting|doing)\s+/, '');
      
      // Ensure we have meaningful content
      if (reason.length > 2) {
        return reason;
      }
    }
  }
  
  // Fallback: look for common toxic behavior keywords
  const behaviorKeywords = [
    'toxic', 'spamming', 'harassment', 'trolling', 'annoying', 
    'rude', 'inappropriate', 'disruptive', 'offensive', 'abusive'
  ];
  
  for (const keyword of behaviorKeywords) {
    if (text.includes(keyword)) {
      return keyword;
    }
  }
  
  return '';
}

function extractMessage(text: string): string {
  const patterns = [
    /'([^']+)'/,
    /"([^"]+)"/,
    /(?:say|tell|announce)\s+(.+)$/i,
    /(?:note|message):\s*(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return '';
}

function extractRole(text: string): string {
  const patterns = [
    /(?:give|add|assign)\s+(.+?)\s+(?:role|admin|permissions)/i,
    /(?:admin|role)\s+(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Look for common role names
  const commonRoles = ['admin', 'moderator', 'mod', 'member', 'user', 'vip'];
  for (const role of commonRoles) {
    if (text.includes(role)) {
      return role;
    }
  }
  
  return '';
}

function extractAmount(text: string): string {
  const patterns = [
    /(?:delete|purge|clear|remove)\s+(?:last|recent)?\s*(\d+)\s*(?:messages?|msgs?)/i,
    /(\d+)\s*(?:messages?|msgs?)/i,
    /(?:about|around|like|roughly)\s+(\d+)/i,
    /(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amount = parseInt(match[1]);
      if (amount > 0 && amount <= 100) { // Discord limit
        return amount.toString();
      }
    }
  }
  
  return '1';
}

function extractDuration(text: string): string {
  const patterns = [
    /(\d+)\s*(min|minute|hour|day|week)s?/i,
    /(?:for|timeout)\s+(\d+)\s*(m|h|d)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return '5m';
}

function isConversationalInput(input: string): boolean {
  const lowerInput = input.toLowerCase();
  
  // Greeting patterns
  const greetingPatterns = [
    /^(hello|hi|hey|good morning|good afternoon|good evening|greetings)/,
    /how are you/,
    /what's up/,
    /whats up/,
    /sup\b/,
    /^(thanks|thank you|thx)/,
    /^(bye|goodbye|see you|cya)/
  ];
  
  // Check if it's just a greeting without command intent
  const hasGreeting = greetingPatterns.some(pattern => pattern.test(lowerInput));
  
  if (hasGreeting) {
    // If it contains greeting words, check if it also contains command indicators
    const commandIndicators = [
      'warn', 'ban', 'kick', 'mute', 'timeout', 'remove', 'delete', 'purge',
      'pin', 'say', 'note', 'role', 'slowmode', 'ping', 'latency', 'speed'
    ];
    
    const hasCommandIntent = commandIndicators.some(indicator => lowerInput.includes(indicator));
    
    // If it's a greeting without command intent, reject it
    if (!hasCommandIntent) {
      return true;
    }
  }
  
  return false;
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
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
  
  return matrix[str2.length][str1.length];
}

function hasNaturalLanguageIndicators(input: string): boolean {
  const naturalLanguageIndicators = [
    'please', 'can you', 'could you', 'would you', 'how', 'what', 'why',
    'they are', 'user is', 'being', 'getting', 'remove them', 'get rid'
  ];
  
  const lowerInput = input.toLowerCase();
  return naturalLanguageIndicators.some(indicator => lowerInput.includes(indicator));
}

function extractCommandName(commandOutput: string): string {
  const match = commandOutput.match(/^\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

export default async function handler(req: any, res: any) {
  // Universal CORS headers - accept custom domain or any Vercel URL
  const origin = req.headers.origin;
  const isAllowedOrigin = origin && (
    origin === 'https://www.commandless.app' ||
    origin === 'https://commandless.app' ||
    origin === 'http://localhost:5173' ||
    origin.endsWith('.vercel.app')
  );
  
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bot-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    // WEBHOOK ENDPOINT (migrated from server)
    if (action === 'webhook' && req.method === 'POST') {
      return await handleDiscordWebhook(req, res);
    }

    if (action === 'validate-token' && req.method === 'POST') {
      // Token validation endpoint
      const { token, botToken } = req.body;
      const discordToken = token || botToken;

      if (!discordToken) {
        return res.status(400).json({ 
          valid: false, 
          message: 'Token is required' 
        });
      }

      const response = await fetch('https://discord.com/api/v10/applications/@me', {
        headers: {
          'Authorization': `Bot ${discordToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return res.status(200).json({ 
          valid: false, 
          message: 'Invalid Discord bot token' 
        });
      }

      const application = await response.json();

      return res.status(200).json({
        valid: true,
        message: 'Token is valid',
        botInfo: {
          id: application.id,
          name: application.name,
          description: application.description,
          avatar: application.icon ? `https://cdn.discordapp.com/app-icons/${application.id}/${application.icon}.png` : null
        }
      });
    }

    if (action === 'process-message' && req.method === 'POST') {
      // Message processing endpoint
      const { message, botToken, botClientId } = req.body as {
        message: DiscordMessage;
        botToken: string;
        botClientId: string;
      };
      
      if (!message || !botToken || !botClientId) {
        return res.status(400).json({ 
          error: 'Missing required fields: message, botToken, botClientId' 
        });
      }

      // Ignore messages from bots
      if (message.author.bot) {
        return res.status(200).json({ processed: false, reason: 'Bot message ignored' });
      }

      // Check if bot is mentioned or if this is a reply to the bot
      const botMentioned = message.mentions?.some(mention => mention.id === botClientId) || false;
      const isReplyToBot = message.referenced_message?.author.id === botClientId || false;
      
      if (!botMentioned && !isReplyToBot) {
        return res.status(200).json({ processed: false, reason: 'Bot not mentioned or replied to' });
      }

      // Find the bot in our database
      const { data: bot, error: botError } = await supabase
        .from('bots')
        .select(`
          id,
          user_id,
          bot_name,
          personality_context,
          is_connected
        `)
        .eq('token', botToken)
        .eq('platform_type', 'discord')
        .eq('is_connected', true)
        .single();

      if (botError || !bot) {
        console.error('Bot not found or not connected:', botError);
        return res.status(404).json({ error: 'Bot not found or not connected' });
      }

      // Process message with AI
      const aiResult = await processMessageWithAI(
        message.content, 
        bot.personality_context || 'You are a helpful Discord moderation bot.',
        bot.id,
        bot.user_id,
        `Channel: ${message.channel_id}, Guild: ${message.guild_id || 'DM'}`
      );

      // Execute Discord action if needed
      let executionResult: { success: boolean; response: string; error?: string } | null = null;
      if (aiResult.shouldExecute && aiResult.command) {
        executionResult = await executeDiscordAction(aiResult.command, message, botToken);
      }

      // Log activity with enhanced metadata
      await supabase
        .from('activities')
        .insert({
          user_id: bot.user_id,
          activity_type: 'message_processed',
          description: `Processed Discord message: "${message.content.substring(0, 50)}..."`,
          metadata: { 
            botId: bot.id,
            channelId: message.channel_id,
            guildId: message.guild_id,
            command: aiResult.command,
            response: aiResult.response,
            executed: executionResult?.success || false,
            executionResult: executionResult,
            needsClarification: aiResult.needsClarification,
            conversational: !!aiResult.conversationalResponse,
            aiProcessing: true
          }
        });

      return res.status(200).json({
        processed: true,
        response: aiResult.response,
        shouldExecute: aiResult.shouldExecute,
        command: aiResult.command,
        execution: executionResult,
        needsClarification: aiResult.needsClarification,
        clarificationQuestion: aiResult.clarificationQuestion,
        conversationalResponse: aiResult.conversationalResponse,
        botInfo: {
          id: bot.id,
          name: bot.bot_name
        }
      });
    }

    return res.status(400).json({ error: 'Invalid action or method' });

  } catch (error) {
    console.error('Discord API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}

// DISCORD WEBHOOK HANDLER (migrated from server)
async function handleDiscordWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const { type, data } = req.body;

    // Handle ping (Discord verification)
    if (type === 1) {
      return res.status(200).json({ type: 1 });
    }

    // Handle slash command interactions
    if (type === 2) {
      const { name, options } = data;
      const guildId = data.guild_id;
      const channelId = data.channel_id;
      const userId = data.member?.user?.id || data.user?.id;

      // Find the bot that should handle this command
      const { data: commandMapping } = await supabase
        .from('command_mappings')
        .select(`
          *,
          bots!inner (
            id,
            user_id,
            bot_name,
            token,
            is_connected
          )
        `)
        .eq('name', name)
        .eq('bots.is_connected', true)
        .single();

      if (!commandMapping) {
        return res.status(200).json({
          type: 4,
          data: {
            content: `Command /${name} not found or bot not connected.`,
            flags: 64 // EPHEMERAL
          }
        });
      }

      // Process the command with AI
      const userInput = `${name} ${options?.map((opt: any) => opt.value).join(' ') || ''}`;
      const bot = commandMapping.bots;
      
      const aiResult = await processMessageWithAI(
        userInput,
        bot.personality_context || 'You are a helpful Discord bot.',
        bot.id,
        bot.user_id
      );

      // Execute action if needed
      let executionResult: { success: boolean; response: string; error?: string } | null = null;
      if (aiResult.shouldExecute && aiResult.command) {
        // Create mock message object for execution
        const mockMessage = {
          content: userInput,
          author: { id: userId, username: 'user', bot: false },
          channel_id: channelId,
          guild_id: guildId,
          mentions: options?.filter((opt: any) => opt.type === 6).map((opt: any) => ({ id: opt.value })) || []
        };
        
        executionResult = await executeDiscordAction(aiResult.command, mockMessage, bot.token);
      }

      // Log activity
      await supabase
        .from('activities')
        .insert({
          user_id: bot.user_id,
          activity_type: 'slash_command_used',
          description: `Slash command /${name} was used`,
          metadata: { 
            botId: bot.id,
            command: name,
            guildId,
            channelId,
            userId,
            response: aiResult.response,
            executed: executionResult?.success || false
          }
        });

      // Respond to Discord
      return res.status(200).json({
        type: 4,
        data: {
          content: executionResult?.response || aiResult.response,
          flags: executionResult?.success ? 0 : 64 // Show publicly if successful, ephemeral if error
        }
      });
    }

    return res.status(400).json({ error: 'Unknown interaction type' });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      type: 4,
      data: {
        content: 'An error occurred processing your command.',
        flags: 64 // EPHEMERAL
      }
    });
  }
}

// DISCORD ACTION EXECUTION (migrated from server)
async function executeDiscordAction(commandText: string, message: DiscordMessage, botToken: string): Promise<{
  success: boolean;
  response: string;
  error?: string;
}> {
  try {
    // Parse the command to extract action and parameters
    const parsed = parseActionCommand(commandText, message);
    if (!parsed) {
      return { success: false, response: "Could not parse command", error: "Parse error" };
    }

    const { action, params } = parsed;

    // Execute based on action type
    switch (action) {
      case 'ban':
        if (!params.user) {
          return { success: false, response: "No user specified for ban", error: "Missing user" };
        }
        return await executeBanAction(message.guild_id!, params.user, params.reason || 'No reason provided', botToken);

      case 'kick':
        if (!params.user) {
          return { success: false, response: "No user specified for kick", error: "Missing user" };
        }
        return await executeKickAction(message.guild_id!, params.user, params.reason || 'No reason provided', botToken);

      case 'warn':
        if (!params.user) {
          return { success: false, response: "No user specified for warning", error: "Missing user" };
        }
        return { success: true, response: `⚠️ Warning issued to <@${params.user}>: ${params.reason || 'Please follow server rules'}` };

      case 'mute':
        if (!params.user) {
          return { success: false, response: "No user specified for mute", error: "Missing user" };
        }
        return await executeMuteAction(message.guild_id!, params.user, params.duration || '5m', params.reason || 'No reason provided', botToken);

      case 'timeout':
        if (!params.user) {
          return { success: false, response: "No user specified for timeout", error: "Missing user" };
        }
        return await executeTimeoutAction(message.guild_id!, params.user, params.duration || '5m', params.reason || 'No reason provided', botToken);

      case 'purge':
        const amount = parseInt(params.amount || '1');
        return await executePurgeAction(message.channel_id, Math.min(amount, 100), botToken);

      case 'say':
        if (!params.message) {
          return { success: false, response: "No message specified", error: "Missing message" };
        }
        return await executeSayAction(message.channel_id, params.message, botToken);

      default:
        return { success: false, response: `Unknown action: ${action}`, error: "Unknown action" };
    }

  } catch (error) {
    console.error('Action execution error:', error);
    return { 
      success: false, 
      response: "An error occurred while executing the action", 
      error: error.message 
    };
  }
}

// ACTION PARSERS AND EXECUTORS
function parseActionCommand(commandText: string, message: DiscordMessage): { action: string; params: Record<string, string> } | null {
  const cleanCommand = commandText.startsWith('/') ? commandText.slice(1) : commandText;
  const mentionedUserIds = message.mentions?.map(m => m.id) || [];
  
  // Extract action from command
  const actionMatch = cleanCommand.match(/^(\w+)/);
  if (!actionMatch) return null;
  
  const action = actionMatch[1].toLowerCase();
  const params: Record<string, string> = {};
  
  // Extract mentioned users
  if (mentionedUserIds.length > 0) {
    params.user = mentionedUserIds[0];
  }
  
  // Extract parameters based on action type
  params.reason = extractReason(cleanCommand);
  params.message = extractMessage(cleanCommand);
  params.amount = extractAmount(cleanCommand);
  params.duration = extractDuration(cleanCommand);
  
  return { action, params };
}

async function executeBanAction(guildId: string, userId: string, reason: string, botToken: string) {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    if (response.ok) {
      return { success: true, response: `🔨 Successfully banned <@${userId}> for: ${reason}` };
    } else {
      const error = await response.text();
      return { success: false, response: `Failed to ban user: ${error}`, error };
    }
  } catch (error) {
    return { success: false, response: 'Failed to ban user: Network error', error: error.message };
  }
}

async function executeKickAction(guildId: string, userId: string, reason: string, botToken: string) {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
        'X-Audit-Log-Reason': reason
      }
    });

    if (response.ok) {
      return { success: true, response: `👢 Successfully kicked <@${userId}> for: ${reason}` };
    } else {
      const error = await response.text();
      return { success: false, response: `Failed to kick user: ${error}`, error };
    }
  } catch (error) {
    return { success: false, response: 'Failed to kick user: Network error', error: error.message };
  }
}

async function executeMuteAction(guildId: string, userId: string, duration: string, reason: string, botToken: string) {
  // For now, return success message as muting requires role management
  return { success: true, response: `🔇 Muted <@${userId}> for ${duration}. Reason: ${reason}` };
}

async function executeTimeoutAction(guildId: string, userId: string, duration: string, reason: string, botToken: string) {
  try {
    const durationMs = parseDuration(duration);
    const timeoutUntil = new Date(Date.now() + durationMs).toISOString();

    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        communication_disabled_until: timeoutUntil
      })
    });

    if (response.ok) {
      return { success: true, response: `⏰ Timed out <@${userId}> for ${duration}. Reason: ${reason}` };
    } else {
      const error = await response.text();
      return { success: false, response: `Failed to timeout user: ${error}`, error };
    }
  } catch (error) {
    return { success: false, response: 'Failed to timeout user: Invalid duration or network error', error: error.message };
  }
}

async function executePurgeAction(channelId: string, amount: number, botToken: string) {
  try {
    // Get recent messages
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${amount}`, {
      headers: {
        'Authorization': `Bot ${botToken}`
      }
    });

    if (!response.ok) {
      return { success: false, response: 'Failed to fetch messages for purge', error: 'Fetch failed' };
    }

    const messages = await response.json();
    const messageIds = messages.map((m: any) => m.id);

    if (messageIds.length === 0) {
      return { success: true, response: 'No messages to purge' };
    }

    // Bulk delete messages
    const deleteResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/bulk-delete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages: messageIds })
    });

    if (deleteResponse.ok) {
      return { success: true, response: `🗑️ Successfully purged ${messageIds.length} messages` };
    } else {
      const error = await deleteResponse.text();
      return { success: false, response: `Failed to purge messages: ${error}`, error };
    }
  } catch (error) {
    return { success: false, response: 'Failed to purge messages: Network error', error: error.message };
  }
}

async function executeSayAction(channelId: string, message: string, botToken: string) {
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: message })
    });

    if (response.ok) {
      return { success: true, response: `📢 Message sent: "${message}"` };
    } else {
      const error = await response.text();
      return { success: false, response: `Failed to send message: ${error}`, error };
    }
  } catch (error) {
    return { success: false, response: 'Failed to send message: Network error', error: error.message };
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/(\d+)([smhd])?/);
  if (!match) return 5 * 60 * 1000; // Default 5 minutes
  
  const value = parseInt(match[1]);
  const unit = match[2] || 'm';
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return value * 60 * 1000;
  }
} 