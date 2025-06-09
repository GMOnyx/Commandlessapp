/**
 * Simplified Test Suite for Scalable Auto-Discovery Command Parsing
 * Tests the core parsing logic with mock data
 */

// Mock storage implementation
const mockStorage = {
  async getBots(userId) {
    return [{
      id: 7,
      userId: "00000000-0000-0000-0000-000000000001",
      platformType: 'discord',
      isConnected: true
    }];
  },
  
  async getCommandMappings(userId) {
    return [
      { id: 1, botId: 7, commandOutput: '/warn {user} {reason}', naturalLanguagePattern: 'warn {user} for {reason}', description: 'Warn a user' },
      { id: 2, botId: 7, commandOutput: '/ban {user} {reason}', naturalLanguagePattern: 'ban {user} for {reason}', description: 'Ban a user from the server' },
      { id: 3, botId: 7, commandOutput: '/kick {user} {reason}', naturalLanguagePattern: 'kick {user} for {reason}', description: 'Kick someone from the server' },
      { id: 4, botId: 7, commandOutput: '/mute {user} {duration}', naturalLanguagePattern: 'mute {user} for {duration}', description: 'Timeout a user' },
      { id: 5, botId: 7, commandOutput: '/note {user} {message}', naturalLanguagePattern: 'note to {user} {message}', description: 'Add a moderator note to the user' },
      { id: 6, botId: 7, commandOutput: '/say {message}', naturalLanguagePattern: 'say {message}', description: 'Make the bot say something' },
      { id: 7, botId: 7, commandOutput: '/purge {amount}', naturalLanguagePattern: 'purge {amount} messages', description: 'Delete multiple messages from a channel' },
      { id: 8, botId: 7, commandOutput: '/pin', naturalLanguagePattern: 'pin this message', description: 'Pins a message' },
      { id: 9, botId: 7, commandOutput: '/ping', naturalLanguagePattern: 'ping', description: 'Check the latency of the bot' },
      { id: 10, botId: 7, commandOutput: '/role {user} {role}', naturalLanguagePattern: 'give {user} {role} role', description: 'Add a role to a server member' },
      { id: 11, botId: 7, commandOutput: '/slowmode {duration}', naturalLanguagePattern: 'set slowmode to {duration}', description: 'Modify the slowmode of a selected channel' },
      { id: 12, botId: 7, commandOutput: '/server-info', naturalLanguagePattern: 'server info', description: 'Get information about the server' }
    ];
  }
};

// Test cases
const testCases = [
  {
    name: 'Basic warn command',
    input: 'warn user123 for spamming',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'warn', hasUser: true, hasReason: true }
  },
  {
    name: 'Natural language ban',
    input: 'please remove spammer they are being toxic',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'ban', hasUser: true, hasReason: true }
  },
  {
    name: 'Informal timeout',
    input: 'timeout user for 1 hour',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'mute', hasUser: true, hasDuration: true }
  },
  {
    name: 'Say command with quotes',
    input: 'say "Hello everyone!"',
    mentionedUsers: [],
    expected: { action: 'say', hasMessage: true }
  },
  {
    name: 'Purge with amount',
    input: 'purge 10 messages',
    mentionedUsers: [],
    expected: { action: 'purge', hasAmount: true }
  },
  {
    name: 'Role assignment',
    input: 'give newuser admin role',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'role', hasUser: true, hasRole: true }
  },
  {
    name: 'Ping request',
    input: 'how fast is your response time?',
    mentionedUsers: [],
    expected: { action: 'ping' }
  },
  {
    name: 'Conversational (should fail)',
    input: 'hello how are you today?',
    mentionedUsers: [],
    expected: null
  },
  {
    name: 'Invalid compound command',
    input: 'warnban user',
    mentionedUsers: ['560079402013032448'],
    expected: null
  },
  {
    name: 'Complex natural language',
    input: 'I think you should warn problematic_user because they have been consistently breaking our server rules',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'warn', hasUser: true, hasReason: true }
  }
];

// Parsing logic implementation
function extractCommandName(commandOutput) {
  const match = commandOutput.match(/^\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len2][len1]) / maxLen;
}

function generateSemanticKeywords(commandName) {
  const keywords = {
    warn: ['warn', 'warning', 'caution', 'alert'],
    ban: ['ban', 'remove', 'kick out', 'banish', 'exile'],
    kick: ['kick', 'boot', 'eject'],
    mute: ['mute', 'silence', 'timeout', 'quiet'],
    note: ['note', 'record', 'remember', 'document'],
    say: ['say', 'tell', 'announce', 'broadcast'],
    purge: ['purge', 'delete', 'clear', 'clean'],
    pin: ['pin', 'stick', 'attach'],
    ping: ['ping', 'latency', 'speed'],
    role: ['role', 'give', 'add', 'assign', 'admin'],
    slowmode: ['slowmode', 'slow', 'rate', 'limit']
  };
  
  return keywords[commandName] || [commandName];
}

function calculateCommandSimilarity(userInput, command) {
  const input = userInput.toLowerCase();
  let score = 0;
  
  const commandName = extractCommandName(command.commandOutput);
  
  // 1. Direct command name match (highest weight)
  if (input.includes(commandName)) {
    score += 0.8;
  }
  
  // 2. Check natural language pattern similarity
  const pattern = command.naturalLanguagePattern.toLowerCase();
  const cleanPattern = pattern.replace(/\{[^}]+\}/g, '').trim();
  
  const inputWords = input.split(/\s+/);
  const patternWords = cleanPattern.split(/\s+/).filter(word => word.length > 2);
  
  const commonWords = inputWords.filter(word => 
    patternWords.some(pWord => 
      word.includes(pWord) || pWord.includes(word) || calculateSimilarity(word, pWord) > 0.7
    )
  );
  
  if (patternWords.length > 0) {
    score += (commonWords.length / patternWords.length) * 0.6;
  }
  
  // 3. Semantic keyword matching based on command type
  const semanticKeywords = generateSemanticKeywords(commandName);
  const keywordMatches = semanticKeywords.filter(keyword => input.includes(keyword));
  
  if (semanticKeywords.length > 0) {
    score += (keywordMatches.length / semanticKeywords.length) * 0.4;
  }
  
  return Math.min(score, 1.0);
}

function extractReason(text) {
  const patterns = [
    /(?:for|because|due to|reason:)\s+(.+)$/i,
    /(?:they|user)\s+(?:keep|keeps|is|are|was|were)\s+(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return '';
}

function extractMessage(text) {
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

function extractRole(text) {
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
  
  const commonRoles = ['admin', 'moderator', 'mod', 'member', 'user', 'vip'];
  for (const role of commonRoles) {
    if (text.includes(role)) {
      return role;
    }
  }
  
  return '';
}

function extractAmount(text) {
  const patterns = [
    /(\d+)\s*(?:messages?|msgs?)/i,
    /(?:about|around|approximately)\s*(\d+)/i,
    /(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return '';
}

function extractDuration(text) {
  const patterns = [
    /(\d+)\s*(?:seconds?|secs?|s)/i,
    /(\d+)\s*(?:minutes?|mins?|m)/i,
    /(\d+)\s*(?:hours?|hrs?|h)/i,
    /(\d+)\s*(?:days?|d)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return '';
}

function extractParametersFromPattern(userInput, pattern, mentionedUserIds) {
  const params = {};
  
  if (mentionedUserIds.length > 0) {
    params.user = mentionedUserIds[0];
  }
  
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

async function findBestCommandMatch(userInput, availableCommands, mentionedUserIds) {
  let bestMatch = null;
  let highestConfidence = 0;
  
  for (const command of availableCommands) {
    const confidence = calculateCommandSimilarity(userInput, command);
    
    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      
      const params = extractParametersFromPattern(userInput, command.naturalLanguagePattern, mentionedUserIds);
      
      bestMatch = {
        command,
        confidence,
        params
      };
    }
  }
  
  return bestMatch;
}

async function parseWithAI(command, mentionedUserIds) {
  try {
    // Get available commands for this bot from database (auto-discovered)
    const bots = await mockStorage.getBots("00000000-0000-0000-0000-000000000001");
    const discordBot = bots.find(bot => bot.platformType === 'discord' && bot.isConnected);
    
    if (!discordBot) {
      return null;
    }
    
    // Get command mappings for this bot (these contain auto-discovered commands)
    const commandMappings = await mockStorage.getCommandMappings("00000000-0000-0000-0000-000000000001");
    const botCommands = commandMappings.filter(cmd => cmd.botId === discordBot.id);
    
    if (botCommands.length === 0) {
      return null;
    }
    
    // Use AI to find the best matching command
    const bestMatch = await findBestCommandMatch(command, botCommands, mentionedUserIds);
    
    if (bestMatch && bestMatch.confidence > 0.3) {
      // Extract the base command name from the command output
      const commandName = extractCommandName(bestMatch.command.commandOutput);
      
      return {
        action: commandName,
        params: bestMatch.params,
        confidence: bestMatch.confidence
      };
    }
    
    return null;
    
  } catch (error) {
    console.log(`Parsing failed: ${error.message}`);
    return null;
  }
}

function validateResult(expected, actual, testName) {
  if (expected === null) {
    if (actual === null) {
      return { pass: true, message: `✅ ${testName}: Correctly returned null` };
    } else {
      return { pass: false, message: `❌ ${testName}: Expected null, got ${JSON.stringify(actual)}` };
    }
  }

  if (actual === null) {
    return { pass: false, message: `❌ ${testName}: Expected result, got null` };
  }

  // Check action
  if (expected.action !== actual.action) {
    return { pass: false, message: `❌ ${testName}: Action mismatch. Expected "${expected.action}", got "${actual.action}"` };
  }

  // Check required parameters
  if (expected.hasUser && !actual.params?.user) {
    return { pass: false, message: `❌ ${testName}: Missing required user parameter` };
  }

  if (expected.hasReason && !actual.params?.reason) {
    return { pass: false, message: `❌ ${testName}: Missing required reason parameter` };
  }

  if (expected.hasMessage && !actual.params?.message) {
    return { pass: false, message: `❌ ${testName}: Missing required message parameter` };
  }

  if (expected.hasAmount && !actual.params?.amount) {
    return { pass: false, message: `❌ ${testName}: Missing required amount parameter` };
  }

  if (expected.hasDuration && !actual.params?.duration) {
    return { pass: false, message: `❌ ${testName}: Missing required duration parameter` };
  }

  if (expected.hasRole && !actual.params?.role) {
    return { pass: false, message: `❌ ${testName}: Missing required role parameter` };
  }

  return { pass: true, message: `✅ ${testName}: All validations passed (confidence: ${actual.confidence?.toFixed(2)})` };
}

async function runTests() {
  console.log('🚀 SCALABLE AUTO-DISCOVERY COMMAND PARSING TESTS');
  console.log('='.repeat(80));
  console.log('Testing with mock auto-discovered commands from Discord bot\n');
  
  let passed = 0;
  let total = testCases.length;
  
  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    
    try {
      const result = await parseWithAI(test.input, test.mentionedUsers);
      const validation = validateResult(test.expected, result, test.name);
      
      console.log(`${i + 1}. ${validation.message}`);
      
      if (result) {
        console.log(`   Input: "${test.input}"`);
        console.log(`   Parsed: ${JSON.stringify(result, null, 2)}`);
      }
      
      if (validation.pass) {
        passed++;
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}\n`);
    }
  }
  
  const successRate = ((passed / total) * 100).toFixed(1);
  
  console.log('='.repeat(80));
  console.log('🎯 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Success Rate: ${successRate}%`);
  
  if (parseFloat(successRate) >= 85) {
    console.log('\n🏆 EXCELLENT: System is production-ready and highly reliable!');
  } else if (parseFloat(successRate) >= 75) {
    console.log('\n👍 VERY GOOD: System works well with minor edge cases');
  } else if (parseFloat(successRate) >= 65) {
    console.log('\n⚠️  GOOD: System works but needs some improvements');
  } else {
    console.log('\n🔧 NEEDS WORK: System requires improvements');
  }
  
  console.log('='.repeat(80));
}

runTests().catch(console.error); 