import { CommandMapping } from '@shared/schema';
import { openai, validateOpenAIConfig } from './client';
import { log } from '../vite';

// Confidence threshold for executing commands without clarification
const CONFIDENCE_THRESHOLD = 0.5; // 50% - significantly lowered threshold to be more permissive

interface IntentMatch {
  command: CommandMapping;
  confidence: number;
  params: Record<string, string>;
}

interface IntentProcessingResult {
  matches: IntentMatch[];
  bestMatch?: IntentMatch;
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
  // If OpenAI is not configured, return empty result
  if (!validateOpenAIConfig()) {
    return { 
      matches: [],
      needsClarification: false
    };
  }
  
  try {
    // Create prompt for OpenAI
    const prompt = createIntentMatchingPrompt(input, availableCommands);
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for more deterministic results
    });
    
    // Parse the response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }
    
    // Parse JSON from the response
    const result = parseOpenAIResponse(content);
    
    // Find best match
    const sortedMatches = result.matches.sort((a, b) => b.confidence - a.confidence);
    const bestMatch = sortedMatches.length > 0 ? sortedMatches[0] : undefined;
    
    // Determine if clarification is needed
    const needsClarification = bestMatch ? bestMatch.confidence < CONFIDENCE_THRESHOLD : true;
    
    // Generate clarification question if needed
    let clarificationQuestion: string | undefined;
    if (needsClarification && bestMatch) {
      clarificationQuestion = result.clarificationQuestion || 
        `Did you mean to ${bestMatch.command.name.toLowerCase()}? Please confirm or provide more details.`;
    } else if (needsClarification) {
      clarificationQuestion = result.clarificationQuestion ||
        "I'm not sure what you want to do. Can you please clarify?";
    }
    
    return {
      matches: sortedMatches,
      bestMatch,
      needsClarification,
      clarificationQuestion
    };
    
  } catch (error) {
    log(`Error processing intent: ${(error as Error).message}`, 'openai');
    return { 
      matches: [],
      needsClarification: true,
      clarificationQuestion: "Sorry, I had trouble understanding your request. Could you try again?"
    };
  }
}

/**
 * Create a prompt for OpenAI to match intent
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
`;
  }).join("\n");
  
  return `You are an intent matching system for a natural language command bot. 
Your task is to analyze the user's input and understand what they want to do, even if their phrasing is highly conversational or differs significantly from the exact command patterns.

AVAILABLE COMMANDS:
${commandDescriptions}

USER INPUT: "${input}"

Analyze the input and determine which command the user is most likely trying to use. You should be VERY flexible and understand conversational language. 

For any command with a pattern containing placeholders like {user}, {reason}, etc., extract the values for these parameters from the user input.

Parameter extraction rules:
1. For {user} parameter:
   - If mentioned with @ (like @johndoe), strip the @ symbol
   - If just a username (like "johndoe"), use as is
   - If mentioned as "this user", "that user", etc., look for the actual username in context
   - If multiple users mentioned, use the most relevant one based on context

2. For {reason} parameter:
   - Extract the reason even if it's not explicitly stated as "because" or "for"
   - Look for context clues about why the action is being taken
   - If no reason given, use "unspecified" as default

3. For other parameters:
   - Extract values based on context and command requirements
   - Use default values when appropriate
   - Handle variations in how parameters are expressed

Assign a confidence score between 0 and 1 for each potentially matching command:
- 0.9-1.0: Perfect match with all parameters
- 0.7-0.8: Clear intent with most parameters
- 0.5-0.6: Likely match but some ambiguity
- 0.3-0.4: Possible match but needs clarification
- 0.0-0.2: Unclear or no match

Be very generous with confidence scores when the intent is clear, even if the phrasing is conversational.
If clear parameters can be extracted from conversational text, the confidence should be above 0.5.

Respond with a JSON object in this format:
{
  "matches": [
    {
      "commandId": number,
      "confidence": number,
      "params": { "parameter1": "value1", "parameter2": "value2", ... }
    },
    ...
  ],
  "clarificationQuestion": "Question to ask if confidence is below threshold"
}

IMPORTANT: Your response must be valid JSON with no additional text.`;
}

/**
 * Parse the OpenAI response to extract intent matches
 */
function parseOpenAIResponse(content: string): {
  matches: IntentMatch[];
  clarificationQuestion?: string;
} {
  try {
    // Extract JSON from the response (in case there's any extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in OpenAI response");
    }
    
    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);
    
    // Map the parsed data to our IntentMatch format
    const matches: IntentMatch[] = [];
    
    for (const match of parsed.matches || []) {
      if (typeof match.commandId !== 'number' || typeof match.confidence !== 'number') {
        continue;
      }
      
      // Find the command by ID
      const command = match.commandId;
      matches.push({
        command: { id: match.commandId } as CommandMapping, // We'll populate the full command later
        confidence: match.confidence,
        params: match.params || {}
      });
    }
    
    return {
      matches,
      clarificationQuestion: parsed.clarificationQuestion
    };
  } catch (error) {
    log(`Error parsing OpenAI response: ${(error as Error).message}`, 'openai');
    return { matches: [] };
  }
}
 