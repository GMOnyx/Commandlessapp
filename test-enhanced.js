/**
 * Enhanced Test Suite with Detailed Analysis
 */

// Same mock storage and basic functions from test-simple.js
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

// Enhanced test cases with detailed analysis
const enhancedTestCases = [
  // SUCCESS CASES
  {
    name: 'Direct command match',
    input: 'warn user123 for spamming',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'warn', hasUser: true, hasReason: true },
    category: 'Direct Commands'
  },
  {
    name: 'Pattern-based matching',
    input: 'timeout user for 1 hour',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'mute', hasUser: true, hasDuration: true },
    category: 'Synonym Mapping'
  },
  {
    name: 'Quoted message extraction',
    input: 'say "Hello everyone!"',
    mentionedUsers: [],
    expected: { action: 'say', hasMessage: true },
    category: 'Parameter Extraction'
  },
  {
    name: 'Amount extraction',
    input: 'purge 10 messages',
    mentionedUsers: [],
    expected: { action: 'purge', hasAmount: true },
    category: 'Parameter Extraction'
  },
  {
    name: 'Role parameter',
    input: 'give newuser admin role',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'role', hasUser: true, hasRole: true },
    category: 'Parameter Extraction'
  },
  {
    name: 'Complex reason extraction',
    input: 'warn user because they have been consistently breaking our server rules',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'warn', hasUser: true, hasReason: true },
    category: 'Complex NLP'
  },
  
  // FAILING CASES (should be fixed)
  {
    name: 'Natural language ban - "remove"',
    input: 'please remove spammer they are being toxic',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'ban', hasUser: true, hasReason: true },
    category: 'Natural Language',
    issue: 'Semantic matching too strict'
  },
  {
    name: 'Ping synonym - "response time"',
    input: 'how fast is your response time?',
    mentionedUsers: [],
    expected: { action: 'ping' },
    category: 'Natural Language',
    issue: 'Missing semantic keywords'
  },
  
  // EDGE CASES
  {
    name: 'Conversational input',
    input: 'hello how are you today?',
    mentionedUsers: [],
    expected: null,
    category: 'Edge Cases'
  },
  {
    name: 'Invalid compound - should be filtered',
    input: 'warnban user',
    mentionedUsers: ['560079402013032448'],
    expected: null,
    category: 'Edge Cases',
    issue: 'Need better compound detection'
  }
];

// Helper functions
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

// ENHANCED semantic keywords with more synonyms
function generateSemanticKeywords(commandName) {
  const keywords = {
    warn: [
      // Direct synonyms
      'warn', 'warning', 'caution', 'alert', 'notify',
      // Action phrases
      'give warning', 'issue warning', 'send warning', 'warn them',
      // Natural language patterns
      'tell them', 'let them know', 'inform them', 'remind them'
    ],
    ban: [
      // Direct synonyms  
      'ban', 'remove', 'banish', 'exile', 'expel', 'eject', 'delete',
      // Action phrases
      'kick out', 'get rid of', 'throw out', 'boot out', 'yeet',
      // Natural language patterns
      'remove them', 'get them out', 'make them leave', 'eliminate',
      'take them out', 'remove from server', 'ban from server'
    ],
    kick: [
      // Direct synonyms
      'kick', 'boot', 'eject', 'throw out', 'remove temporarily',
      // Action phrases  
      'kick out', 'boot them', 'throw them out',
      // Natural language patterns
      'make them leave temporarily', 'remove for now'
    ],
    mute: [
      // Direct synonyms
      'mute', 'silence', 'timeout', 'quiet', 'shush', 'hush',
      // Action phrases
      'time out', 'shut up', 'make quiet', 'silence them',
      // Natural language patterns
      'stop them talking', 'prevent them speaking', 'calm them down'
    ],
    note: [
      // Direct synonyms
      'note', 'record', 'remember', 'document', 'write', 'log',
      // Action phrases
      'make note', 'add note', 'take note', 'write down',
      // Natural language patterns
      'keep track', 'make record', 'document this', 'remember that'
    ],
    say: [
      // Direct synonyms
      'say', 'tell', 'announce', 'broadcast', 'declare', 'proclaim',
      // Action phrases
      'tell everyone', 'let everyone know', 'make announcement',
      // Natural language patterns
      'inform everyone', 'share with everyone', 'communicate to all'
    ],
    purge: [
      // Direct synonyms
      'purge', 'delete', 'clear', 'clean', 'remove', 'wipe',
      // Action phrases
      'clean up', 'get rid of', 'clear out', 'delete messages',
      // Natural language patterns
      'remove messages', 'clean messages', 'clear chat'
    ],
    pin: [
      // Direct synonyms
      'pin', 'stick', 'attach', 'fix', 'secure', 'fasten',
      // Action phrases
      'pin message', 'stick message', 'pin this', 'pin above',
      // Natural language patterns
      'keep this visible', 'make this permanent', 'save this message'
    ],
    ping: [
      // Direct synonyms
      'ping', 'latency', 'speed', 'delay', 'lag',
      // Performance terms
      'response', 'fast', 'quick', 'time', 'ms', 'milliseconds',
      // Question patterns
      'how fast', 'how quick', 'response time', 'reaction time',
      // Natural language patterns
      'check speed', 'test speed', 'check latency', 'test ping',
      'how responsive', 'performance check', 'speed test'
    ],
    role: [
      // Direct synonyms
      'role', 'permission', 'rank', 'status', 'position',
      // Action verbs
      'give', 'add', 'assign', 'grant', 'promote', 'elevate',
      // Specific roles
      'admin', 'moderator', 'mod', 'member', 'user', 'vip',
      // Action phrases
      'give role', 'add role', 'assign role', 'make admin',
      // Natural language patterns
      'promote to', 'give permissions', 'make them', 'assign them'
    ],
    slowmode: [
      // Direct synonyms
      'slowmode', 'slow', 'rate', 'limit', 'throttle', 'restrict',
      // Action phrases
      'slow down', 'rate limit', 'limit messages', 'restrict chat',
      // Natural language patterns
      'make slower', 'reduce speed', 'control rate'
    ]
  };
  
  return keywords[commandName] || [commandName];
}

// ENHANCED similarity calculation with better natural language matching
function calculateCommandSimilarity(userInput, command) {
  const input = userInput.toLowerCase();
  let score = 0;
  
  const commandName = extractCommandName(command.commandOutput);
  
  // 1. Direct command name match (highest weight)
  if (input.includes(commandName)) {
    score += 0.8;
  }
  
  // 2. Phrase-level pattern matching for natural language
  const phraseScore = calculatePhrasePatternScore(input, commandName);
  score += phraseScore * 0.7;
  
  // 3. Check natural language pattern similarity
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
    score += (commonWords.length / patternWords.length) * 0.5;
  }
  
  // 4. ENHANCED semantic keyword matching
  const semanticKeywords = generateSemanticKeywords(commandName);
  const keywordMatches = semanticKeywords.filter(keyword => input.includes(keyword));
  
  if (semanticKeywords.length > 0) {
    score += (keywordMatches.length / semanticKeywords.length) * 0.4;
  }
  
  // 5. Description matching (if available)
  if (command.description) {
    const descWords = command.description.toLowerCase().split(/\s+/);
    const descMatches = inputWords.filter(word => 
      descWords.some(dWord => calculateSimilarity(word, dWord) > 0.8)
    );
    
    if (descWords.length > 0) {
      score += (descMatches.length / descWords.length) * 0.2;
    }
  }
  
  return Math.min(score, 1.0);
}

/**
 * Calculate phrase-level pattern matching score for natural language commands
 */
function calculatePhrasePatternScore(input, commandName) {
  const phrasePatterns = {
    ban: [
      'please remove', 'can you remove', 'get rid of', 'kick out',
      'ban them', 'remove them', 'they need to go', 'take them out',
      'eliminate user', 'delete user', 'boot them', 'yeet them'
    ],
    kick: [
      'kick them out', 'boot them', 'throw them out', 'remove temporarily',
      'get them out of here', 'make them leave'
    ],
    warn: [
      'give warning', 'issue warning', 'warn them', 'tell them off',
      'let them know', 'give them warning', 'issue them warning'
    ],
    mute: [
      'silence them', 'make them quiet', 'shut them up', 'time them out',
      'timeout user', 'stop them talking', 'prevent them speaking'
    ],
    ping: [
      'how fast', 'how quick', 'response time', 'check speed', 'test ping',
      'check latency', 'what is ping', 'how responsive', 'speed test',
      'performance check', 'reaction time', 'how fast is', 'speed of'
    ],
    say: [
      'tell everyone', 'announce to all', 'let everyone know', 'inform all',
      'broadcast message', 'share with everyone', 'make announcement'
    ],
    purge: [
      'delete messages', 'clear messages', 'clean up messages', 'remove messages',
      'clear chat', 'clean chat', 'wipe messages', 'get rid of messages'
    ],
    pin: [
      'pin this message', 'stick this', 'pin the message', 'keep this visible',
      'make this permanent', 'attach this message', 'save this message'
    ],
    note: [
      'make note', 'add note', 'take note', 'write down', 'record this',
      'remember this', 'document this', 'keep track of'
    ],
    role: [
      'give role', 'add role', 'assign role', 'make admin', 'promote to',
      'give permissions', 'assign permissions', 'grant role'
    ]
  };
  
  const patterns = phrasePatterns[commandName] || [];
  let maxScore = 0;
  
  for (const phrase of patterns) {
    if (input.includes(phrase)) {
      maxScore = Math.max(maxScore, 1.0);
    } else {
      // Check for partial phrase matches
      const phraseWords = phrase.split(/\s+/);
      const inputWords = input.split(/\s+/);
      
      let matchedWords = 0;
      for (const phraseWord of phraseWords) {
        if (inputWords.some(inputWord => 
          inputWord.includes(phraseWord) || 
          phraseWord.includes(inputWord) ||
          calculateSimilarity(inputWord, phraseWord) > 0.8
        )) {
          matchedWords++;
        }
      }
      
      if (phraseWords.length > 0) {
        const partialScore = (matchedWords / phraseWords.length) * 0.8;
        maxScore = Math.max(maxScore, partialScore);
      }
    }
  }
  
  return maxScore;
}

function hasNaturalLanguageIndicators(input) {
  const naturalLanguageIndicators = [
    'please', 'can you', 'could you', 'would you', 'how', 'what', 'why',
    'they are', 'user is', 'being', 'getting', 'remove them', 'get rid'
  ];
  
  const lowerInput = input.toLowerCase();
  return naturalLanguageIndicators.some(indicator => lowerInput.includes(indicator));
}

// Enhanced parameter extraction functions
function extractReason(text) {
  const patterns = [
    /(?:for|because|due to|reason:)\s+(.+)$/i,
    /(?:they|user)\s+(?:keep|keeps|is|are|was|were)\s+(.+)$/i,
    /(?:being|getting)\s+(.+)$/i  // Added pattern for "being toxic"
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

// ENHANCED compound detection
function isInvalidCompound(input) {
  const compoundPatterns = [
    /\b(warn|ban|kick|mute)(ban|warn|kick|mute)\b/i,
    /\b(ban|kick)warn\b/i,
    /\bwarn(ban|kick)\b/i
  ];
  
  return compoundPatterns.some(pattern => pattern.test(input));
}

async function findBestCommandMatch(userInput, availableCommands, mentionedUserIds) {
  // Check for invalid compounds first
  if (isInvalidCompound(userInput)) {
    return null;
  }
  
  // Check for conversational input that should be rejected
  if (isConversationalInput(userInput)) {
    return null;
  }
  
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

/**
 * Check if input is conversational/greeting that should not be parsed as a command
 */
function isConversationalInput(input) {
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

async function parseWithAI(command, mentionedUserIds) {
  try {
    const bots = await mockStorage.getBots("00000000-0000-0000-0000-000000000001");
    const discordBot = bots.find(bot => bot.platformType === 'discord' && bot.isConnected);
    
    if (!discordBot) {
      return null;
    }
    
    const commandMappings = await mockStorage.getCommandMappings("00000000-0000-0000-0000-000000000001");
    const botCommands = commandMappings.filter(cmd => cmd.botId === discordBot.id);
    
    if (botCommands.length === 0) {
      return null;
    }
    
    const bestMatch = await findBestCommandMatch(command, botCommands, mentionedUserIds);
    
    // Lower threshold for better natural language coverage, with context-aware scoring  
    const threshold = hasNaturalLanguageIndicators(command) ? 0.15 : 0.25;
    
    if (bestMatch && bestMatch.confidence > threshold) {
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

  if (expected.action !== actual.action) {
    return { pass: false, message: `❌ ${testName}: Action mismatch. Expected "${expected.action}", got "${actual.action}"` };
  }

  // Check parameters
  const paramChecks = ['hasUser', 'hasReason', 'hasMessage', 'hasAmount', 'hasDuration', 'hasRole'];
  const paramNames = ['user', 'reason', 'message', 'amount', 'duration', 'role'];
  
  for (let i = 0; i < paramChecks.length; i++) {
    if (expected[paramChecks[i]] && !actual.params?.[paramNames[i]]) {
      return { pass: false, message: `❌ ${testName}: Missing required ${paramNames[i]} parameter` };
    }
  }

  return { pass: true, message: `✅ ${testName}: All validations passed (confidence: ${actual.confidence?.toFixed(2)})` };
}

async function runEnhancedTests() {
  console.log('🚀 ENHANCED SCALABLE AUTO-DISCOVERY COMMAND PARSING TESTS');
  console.log('='.repeat(90));
  console.log('Testing with improved natural language processing and edge case handling\n');
  
  let passed = 0;
  let total = enhancedTestCases.length;
  const categoryResults = {};
  
  for (let i = 0; i < enhancedTestCases.length; i++) {
    const test = enhancedTestCases[i];
    const category = test.category || 'General';
    
    if (!categoryResults[category]) {
      categoryResults[category] = { passed: 0, total: 0, tests: [] };
    }
    categoryResults[category].total++;
    
    try {
      const result = await parseWithAI(test.input, test.mentionedUsers);
      const validation = validateResult(test.expected, result, test.name);
      
      categoryResults[category].tests.push({
        name: test.name,
        passed: validation.pass,
        issue: test.issue || null,
        result: result
      });
      
      if (validation.pass) {
        passed++;
        categoryResults[category].passed++;
      }
      
      console.log(`${i + 1}. ${validation.message}`);
      
      if (result) {
        console.log(`   Input: "${test.input}"`);
        if (test.issue) {
          console.log(`   🔧 Known Issue: ${test.issue}`);
        }
        console.log(`   Parsed: ${JSON.stringify(result, null, 2)}`);
      } else if (test.issue) {
        console.log(`   🔧 Known Issue: ${test.issue}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}\n`);
      categoryResults[category].tests.push({
        name: test.name,
        passed: false,
        error: error.message
      });
    }
  }
  
  const successRate = ((passed / total) * 100).toFixed(1);
  
  console.log('='.repeat(90));
  console.log('🎯 ENHANCED TEST RESULTS');
  console.log('='.repeat(90));
  
  // Category breakdown
  console.log('📊 Results by Category:');
  for (const [category, data] of Object.entries(categoryResults)) {
    const categoryRate = ((data.passed / data.total) * 100).toFixed(1);
    console.log(`  ${category}: ${data.passed}/${data.total} (${categoryRate}%)`);
    
    // Show failing tests with issues
    const failing = data.tests.filter(t => !t.passed);
    if (failing.length > 0) {
      failing.forEach(test => {
        if (test.issue) {
          console.log(`    🔧 ${test.name}: ${test.issue}`);
        } else {
          console.log(`    ❌ ${test.name}: Unexpected failure`);
        }
      });
    }
  }
  
  console.log(`\nOverall: ${passed}/${total} (${successRate}%)`);
  
  if (parseFloat(successRate) >= 90) {
    console.log('\n🏆 EXCELLENT: System is production-ready and highly reliable!');
  } else if (parseFloat(successRate) >= 80) {
    console.log('\n👍 VERY GOOD: System works well with known limitations');
  } else if (parseFloat(successRate) >= 70) {
    console.log('\n⚠️  GOOD: System works but needs targeted improvements');
  } else {
    console.log('\n🔧 NEEDS WORK: System requires significant improvements');
  }
  
  console.log('='.repeat(90));
  
  return { passed, total, successRate: parseFloat(successRate), categoryResults };
}

runEnhancedTests().catch(console.error); 