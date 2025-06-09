import { CommandMapping } from '@shared/schema';
import { log } from '../vite';

/**
 * Result of pattern matching
 */
interface PatternMatchResult {
  matched: boolean;
  params: Record<string, string>;
}

/**
 * Find all command mappings that match the natural language input
 * 
 * @param input Natural language input to process
 * @param commandMappings Array of command mappings to check against
 * @returns Array of matched commands with extracted parameters
 */
export function findMatchingCommands(
  input: string, 
  commandMappings: CommandMapping[]
): Array<{ command: CommandMapping, params: Record<string, string> }> {
  const results: Array<{ command: CommandMapping, params: Record<string, string> }> = [];
  
  // Process input
  const normalizedInput = input.trim().toLowerCase();
  
  for (const command of commandMappings) {
    // Skip inactive commands
    if (command.status !== 'active') {
      continue;
    }
    
    // Try to match the pattern
    const matchResult = matchPattern(normalizedInput, command.naturalLanguagePattern);
    
    if (matchResult.matched) {
      results.push({
        command,
        params: matchResult.params
      });
    }
  }
  
  return results;
}

/**
 * Match an input string against a pattern with placeholders
 * 
 * @param input Input string to match (normalized to lowercase)
 * @param pattern Pattern string with {placeholders}
 * @returns Match result with extracted parameters
 */
function matchPattern(input: string, pattern: string): PatternMatchResult {
  try {
    // Normalize the pattern to lowercase for case-insensitive matching
    const normalizedPattern = pattern.toLowerCase();
    
    // Extract parameters from the pattern
    const paramNames: string[] = [];
    const patternRegex = normalizedPattern.replace(/{([^}]+)}/g, (match, paramName) => {
      paramNames.push(paramName);
      return '(.+?)'; // Capture group for parameter value
    });
    
    // Create regex with anchors to match the whole input
    const regex = new RegExp(`^${patternRegex}$`);
    const match = input.match(regex);
    
    if (!match) {
      return { matched: false, params: {} };
    }
    
    // Extract parameter values
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = match[i + 1]; // +1 because match[0] is the full match
    }
    
    return { matched: true, params };
  } catch (error) {
    // Log error but don't throw, just return no match
    log(`Error matching pattern: ${(error as Error).message}`, 'discord');
    return { matched: false, params: {} };
  }
}

/**
 * Apply parameter values to a command output template
 * 
 * @param template Command output template with {placeholders}
 * @param params Parameter values
 * @returns Completed command string
 */
export function applyParamsToTemplate(
  template: string,
  params: Record<string, string>
): string {
  let result = template;
  
  // Replace each parameter in the template
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `{${key}}`;
    // Replace all occurrences of the placeholder with the parameter value
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return result;
} 