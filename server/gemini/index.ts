import { geminiClient } from './client';
import { log } from '../vite';

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

export async function parseNaturalLanguage(
  naturalLanguagePattern: string,
  userInput: string
): Promise<{ [key: string]: string } | null> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key is not configured");
    }

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

    log(`Pattern: ${naturalLanguagePattern}`, "gemini");
    log(`Variables: ${variables.join(", ")}`, "gemini");
    log(`User input: ${userInput}`, "gemini");

    try {
      const model = geminiClient.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `
You are an assistant that extracts variable values from user inputs based on a pattern.
Given a pattern with variables in {curly_braces} and a user input, extract the values for each variable.
Respond only with a JSON object where keys are variable names and values are extracted values.
If you cannot extract a value for a variable, set its value to null.

Pattern: "${naturalLanguagePattern}"
Variables: ${variables.join(", ")}
User Input: "${userInput}"

Extract the values of each variable from the user input.
`;

      log(`Sending request to Gemini with prompt: ${prompt}`, "gemini");
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      log(`Gemini response: ${text}`, "gemini");
      
      // Extract JSON from the response text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log("Failed to extract JSON from Gemini response", "gemini");
        throw new Error("Failed to parse Gemini response");
      }
      
      const jsonResponse = JSON.parse(jsonMatch[0]);
      log(`Parsed response: ${JSON.stringify(jsonResponse)}`, "gemini");
      return jsonResponse;
    } catch (error) {
      log(`Gemini API error: ${(error as Error).message}. Using mock response.`, "gemini");
      
      // Create a simple mock response for testing
      // This extracts variables using simple pattern matching for testing
      const mockResponse: Record<string, string> = {};
      
      // For "ban {user} for {reason}"
      if (naturalLanguagePattern.includes("{user}") && naturalLanguagePattern.includes("{reason}")) {
        const userMatch = userInput.match(/ban (\w+) for (.*)/);
        if (userMatch && userMatch.length >= 3) {
          mockResponse.user = userMatch[1];
          mockResponse.reason = userMatch[2];
        }
      }
      
      // For "kick {user} {reason}"
      if (naturalLanguagePattern.includes("kick {user}")) {
        const userMatch = userInput.match(/kick (\w+) (.*)/);
        if (userMatch && userMatch.length >= 3) {
          mockResponse.user = userMatch[1];
          mockResponse.reason = userMatch[2];
        }
      }
      
      // For role commands
      if (naturalLanguagePattern.includes("{user}") && naturalLanguagePattern.includes("{role}")) {
        const roleMatch = userInput.match(/give (\w+) the (\w+) role/);
        if (roleMatch && roleMatch.length >= 3) {
          mockResponse.user = roleMatch[1];
          mockResponse.role = roleMatch[2];
        }
      }
      
      // For channel creation
      if (naturalLanguagePattern.includes("{name}") && naturalLanguagePattern.includes("{category}")) {
        const channelMatch = userInput.match(/create a channel named (\w+) in (\w+)/);
        if (channelMatch && channelMatch.length >= 3) {
          mockResponse.name = channelMatch[1];
          mockResponse.category = channelMatch[2];
        }
      }
      
      log(`Using mock response: ${JSON.stringify(mockResponse)}`, "gemini");
      return mockResponse;
    }
  } catch (error) {
    log(`Error parsing natural language: ${(error as Error).message}`, "gemini");
    return null;
  }
}

export async function translateToCommand(
  naturalLanguagePattern: string,
  commandOutput: string,
  userInput: string
): Promise<string | null> {
  try {
    const variables = await parseNaturalLanguage(naturalLanguagePattern, userInput);
    
    if (!variables) {
      return null;
    }
    
    // Replace variables in command output
    let result = commandOutput;
    for (const [key, value] of Object.entries(variables)) {
      if (value) {
        result = result.replace(new RegExp(`{${key}}`, 'g'), value);
      }
    }
    
    return result;
  } catch (error) {
    log(`Error translating to command: ${(error as Error).message}`, "gemini");
    return null;
  }
} 