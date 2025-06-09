import { CommandMapping } from '@shared/schema';
import { geminiClient, validateGeminiConfig } from './client';
import { log } from '../vite';

// Confidence threshold for executing commands without clarification
const CONFIDENCE_THRESHOLD = 0.6; // 60% - balanced threshold with enhanced unknown command detection

interface IntentMatch {
  command: CommandMapping;
  confidence: number;
  params: Record<string, string>;
}

export interface IntentProcessingResult {
  matches: IntentMatch[];
  needsClarification: boolean;
  clarificationQuestion?: string;
}

/**
 * Process user input to determine intent and match to commands
 * 
 * @param input User's natural language input
 * @param availableCommands Array of possible commands to match against
 * @returns Processing result with matches and clarification info
 */
export async function processIntent(
  input: string,
  availableCommands: CommandMapping[]
): Promise<IntentProcessingResult> {
  // If Gemini is not configured, return empty result
  if (!validateGeminiConfig()) {
    return { 
      matches: [],
      needsClarification: false
    };
  }
  
  try {
    // Create prompt for Gemini
    const prompt = createIntentMatchingPrompt(input, availableCommands);
    
    // Call Gemini API
    const model = geminiClient.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    if (!content) {
      throw new Error("Empty response from Gemini");
    }
    
    // Parse JSON from the response
    const parsedResult = parseGeminiResponse(content, availableCommands);
    
    // Find best match
    const sortedMatches = parsedResult.matches.sort((a, b) => b.confidence - a.confidence);
    const bestMatch = sortedMatches.length > 0 ? sortedMatches[0] : undefined;
    
    // Determine if clarification is needed
    const needsClarification = bestMatch ? bestMatch.confidence < CONFIDENCE_THRESHOLD : true;
    
    // Generate clarification question if needed
    let clarificationQuestion: string | undefined;
    if (needsClarification) {
      if (bestMatch && bestMatch.confidence > 0.4) {
        // Medium confidence - ask for confirmation
        clarificationQuestion = `Did you mean to ${bestMatch.command.name.toLowerCase()}? Please confirm or provide more details.`;
      } else {
        // Low confidence - show available commands
        const commandList = availableCommands
          .slice(0, 8) // Limit to first 8 commands to avoid overwhelming
          .map(cmd => `• ${cmd.name}: ${cmd.naturalLanguagePattern.replace(/\{[^}]+\}/g, '[...]')}`)
          .join('\n');
        
        clarificationQuestion = `I'm not sure what you want to do. Here are some things I can help with:\n\n${commandList}\n\nPlease try rephrasing your request.`;
      }
    }

    return {
      matches: sortedMatches,
      needsClarification,
      clarificationQuestion
    };
  } catch (error) {
    log('error', `Gemini intent processing failed: ${error}`);
    return {
      matches: [],
      needsClarification: true,
      clarificationQuestion: "I'm having trouble understanding that. Could you please rephrase your request?"
    };
  }
}

/**
 * Create a prompt for Gemini to match intent
 */
function createIntentMatchingPrompt(
  input: string, 
  availableCommands: CommandMapping[]
): string {
  // Format commands for the prompt
  const commandDescriptions = availableCommands.map(cmd => {
    return `Command: ${cmd.name}
Pattern: ${cmd.naturalLanguagePattern}
Command ID: ${cmd.id}
Output Template: ${cmd.commandOutput}
`;
  }).join("\n");
  
  return `🤖 **ADVANCED INTENT MATCHING SYSTEM**

You are a sophisticated natural language processor for Discord bot commands. Your mission: understand what users REALLY want, even when they use casual, conversational, or creative language.

AVAILABLE COMMANDS:
${commandDescriptions}

USER INPUT: "${input}"

🧠 **SEMANTIC UNDERSTANDING RULES:**

**1. FLEXIBLE ACTION MAPPING:**
Map any related words/phrases to command intents:
- ban/remove/kick out/get rid of/banish/exile → BAN command
- warn/warning/caution/alert/notify → WARN command  
- say/tell/announce/broadcast/declare/inform → SAY command
- delete/clear/purge/clean/remove/wipe → PURGE command
- pin/stick/attach/fix/secure → PIN command
- mute/silence/timeout/quiet/hush → MUTE command
- kick/boot/eject/throw out → KICK command
- ping/latency/speed/fast/response/delay → PING command
- server/guild/info/details/stats/about → SERVER-INFO command
- note/record/remember/document/write/log → NOTE command

**2. CONVERSATIONAL PATTERN RECOGNITION:**
Understand natural speech patterns:
- "can you please..." → polite command request
- "nothing much, just..." → casual command mention
- "hey bot, when you have time..." → conversational command
- "that user..." → reference to someone for moderation
- "tell everyone..." → broadcast/announcement intent
- "get rid of..." → removal/deletion intent
- "check..." → query/status request intent

**3. AGGRESSIVE PARAMETER EXTRACTION:**

**Discord Mentions** (CRITICAL):
- Extract ALL user IDs from <@123456> or <@!123456> format
- "ban <@560079402013032448> for trolling" → user: "560079402013032448"
- "nothing much just warn <@123> really" → user: "123"

**Reasons & Messages**:
- Look for context clues: "for X", "because Y", "due to Z"
- Extract full phrases: "being toxic and annoying everyone"
- Handle implicit reasons: "that spammer" → reason: "spamming"

**Amounts & Numbers**:
- Extract ANY numbers: "delete 5 messages", "about 10", "like 15"
- Handle word numbers: "five messages" → "5"

**Context Messages**:
- Extract quoted text: "tell everyone 'meeting at 3pm'"
- Understand implied messages: "announce the event is cancelled"

**4. CONFIDENCE SCORING PHILOSOPHY:**

🟢 **HIGH CONFIDENCE (80-100)**: Execute immediately
- Clear action words + parameters found
- Discord mentions present for moderation commands
- Numbers found for amount-based commands
- Quoted/implied messages for say/note commands

🟡 **MEDIUM CONFIDENCE (60-79)**: Still execute, but note uncertainty
- Action intent clear but some parameters missing
- Conversational phrasing but intent obvious

🔴 **LOW CONFIDENCE (30-59)**: Ask for clarification
- Multiple possible interpretations
- Critical parameters completely missing

❌ **NO CONFIDENCE (0-29)**: Not a command
- Pure conversation/questions
- No action words detected

**5. EXAMPLES OF SMART EXTRACTION:**

Input: "nothing much just ban <@560079402013032448> for being annoying"
→ Command: BAN, user: "560079402013032448", reason: "being annoying", confidence: 95

Input: "can you delete like 5 messages please"  
→ Command: PURGE, amount: "5", confidence: 90

Input: "tell everyone the meeting moved to tomorrow"
→ Command: SAY, message: "the meeting moved to tomorrow", confidence: 95

Input: "that user keeps trolling, give them a warning"
→ Command: WARN, reason: "keeps trolling", confidence: 75 (need user ID)

Input: "yo bot, what's your ping like?"
→ Command: PING, confidence: 85

Input: "remove that toxic user from the server"
→ Command: BAN, reason: "toxic", confidence: 70 (need user ID)

Input: "hi how are you doing today?"
→ NOT A COMMAND, confidence: 0

**6. RESPONSE FORMAT:**

Respond with VALID JSON only:

\`\`\`json
{
  "matches": [
    {
      "commandId": <number>,
      "confidence": <0-100>,
      "params": {
        "user": "discord_user_id",
        "reason": "complete_reason_text", 
        "message": "complete_message_text",
        "amount": "number_as_string"
      }
    }
  ],
  "clarificationQuestion": "Only if confidence < 60 and truly needed"
}
\`\`\`

🚀 **EXECUTE BOLDLY**: If you understand the intent and can extract meaningful parameters, GO FOR IT! Users prefer action over endless clarification questions.

⚡ **BE SMART**: Look at context, implied meanings, and conversational patterns. You're not just pattern matching - you're understanding human communication!`;
}

/**
 * Parse the Gemini response to extract intent matches
 */
function parseGeminiResponse(content: string, availableCommands: CommandMapping[]): {
  matches: IntentMatch[];
  clarificationQuestion?: string;
} {
  try {
    // Extract JSON from the response (in case there's any extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Gemini response");
    }
    
    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);
    
    // Map the parsed data to our IntentMatch format
    const matches: IntentMatch[] = [];
    
    for (const match of parsed.matches || []) {
      if (typeof match.commandId !== 'number' || typeof match.confidence !== 'number') {
        continue;
      }
      
      // Find the actual command by ID from available commands
      const command = availableCommands.find(cmd => cmd.id === match.commandId);
      if (!command) {
        log(`Command with ID ${match.commandId} not found in available commands`, 'gemini');
        continue;
      }
      
      matches.push({
        command: command,
        confidence: match.confidence,
        params: match.params || {}
      });
    }
    
    return {
      matches,
      clarificationQuestion: parsed.clarificationQuestion
    };
  } catch (error) {
    log(`Error parsing Gemini response: ${(error as Error).message}`, 'gemini');
    return { matches: [] };
  }
} 