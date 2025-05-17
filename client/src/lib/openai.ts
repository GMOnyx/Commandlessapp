import { apiRequest } from "./queryClient";

export async function testCommandMapping(
  mappingId: number, 
  userInput: string
) {
  try {
    const response = await apiRequest(
      "POST", 
      `/api/mappings/${mappingId}/test`, 
      { userInput }
    );
    
    return await response.json();
  } catch (error) {
    console.error("Error testing command mapping", error);
    throw error;
  }
}

export async function useCommandMapping(
  mappingId: number, 
  userInput: string
) {
  try {
    const response = await apiRequest(
      "POST", 
      `/api/mappings/${mappingId}/use`, 
      { userInput }
    );
    
    return await response.json();
  } catch (error) {
    console.error("Error using command mapping", error);
    throw error;
  }
}

// Extract variables from natural language pattern
export function extractVariablesFromPattern(pattern: string): string[] {
  const variableRegex = /{([^}]+)}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = variableRegex.exec(pattern)) !== null) {
    variables.push(match[1]);
  }
  
  return variables;
}
