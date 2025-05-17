import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-4o";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function parseNaturalLanguage(
  naturalLanguagePattern: string,
  userInput: string
): Promise<{ [key: string]: string } | null> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
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

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: 
            "You are an assistant that extracts variable values from user inputs based on a pattern. " +
            "Given a pattern with variables in {curly_braces} and a user input, extract the values for each variable. " +
            "Respond only with a JSON object where keys are variable names and values are extracted values. " +
            "If you cannot extract a value for a variable, set its value to null."
        },
        {
          role: "user",
          content: `
Pattern: "${naturalLanguagePattern}"
Variables: ${variables.join(", ")}
User Input: "${userInput}"

Extract the values of each variable from the user input.
`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error("Error parsing natural language:", error);
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
    console.error("Error translating to command:", error);
    return null;
  }
}
