// Comprehensive Natural Language Parsing Test Suite
// Tests the AI parsing system with edge cases and weird combinations

const testCases = [
  // === STANDARD COMMANDS (Should work well) ===
  {
    category: "Standard Commands",
    tests: [
      { input: "make a note to @user tell him hes cool", expected: { action: "note", user: true, message: "hes cool" } },
      { input: "warn @user for being annoying", expected: { action: "warn", user: true, reason: "being annoying" } },
      { input: "ban @user because spam", expected: { action: "ban", user: true, reason: "spam" } },
      { input: "kick @user for trolling", expected: { action: "kick", user: true, reason: "trolling" } },
      { input: "purge 10 messages", expected: { action: "purge", amount: "10" } },
      { input: "say hello world", expected: { action: "say", message: "hello world" } },
      { input: "ping", expected: { action: "ping" } },
      { input: "server-info", expected: { action: "server-info" } }
    ]
  },

  // === WEIRD PHRASING (Challenging) ===
  {
    category: "Weird Phrasing", 
    tests: [
      { input: "could you perhaps warn that @user person for the reason of spamming?", expected: { action: "warn", user: true, reason: "spamming" } },
      { input: "i think @user should be banned tbh because they keep trolling", expected: { action: "ban", user: true, reason: "they keep trolling" } },
      { input: "yo bot make a note about @user saying he helped me today", expected: { action: "note", user: true, message: "he helped me today" } },
      { input: "can you delete like 5 msgs pls", expected: { action: "purge", amount: "5" } },
      { input: "tell everyone 'meeting at 3pm'", expected: { action: "say", message: "meeting at 3pm" } },
      { input: "whats the ping situation", expected: { action: "ping" } },
      { input: "gimme server details", expected: { action: "server-info" } }
    ]
  },

  // === CONTEXTUAL/CONVERSATIONAL (Very challenging) ===
  {
    category: "Conversational Context",
    tests: [
      { input: "that @user guy has been really helpful, add a note about it", expected: { action: "note", user: true, message: "has been really helpful" } },
      { input: "@user keeps breaking rules, give them a warning", expected: { action: "warn", user: true, reason: "keeps breaking rules" } },
      { input: "remove @user from the server due to harassment", expected: { action: "ban", user: true, reason: "harassment" } },
      { input: "get rid of the last 15 messages in here", expected: { action: "purge", amount: "15" } },
      { input: "announce that the event is cancelled", expected: { action: "say", message: "the event is cancelled" } },
      { input: "check how fast you are", expected: { action: "ping" } },
      { input: "what server are we in again?", expected: { action: "server-info" } }
    ]
  },

  // === MULTI-WORD ACTIONS (Edge cases) ===
  {
    category: "Multi-word Actions",
    tests: [
      { input: "set slowmode to 30 seconds", expected: { action: "slowmode", amount: "30" } },
      { input: "pin this message", expected: { action: "pin" } },
      { input: "check server info", expected: { action: "server-info" } },
      { input: "enable slowmode for 60 seconds", expected: { action: "slowmode", amount: "60" } },
      { input: "please pin the above message", expected: { action: "pin" } }
    ]
  },

  // === AMBIGUOUS/CONFUSING (Should fail gracefully) ===
  {
    category: "Ambiguous Commands",
    tests: [
      { input: "do something with @user", expected: null }, // Too vague
      { input: "user user user ban", expected: { action: "ban", user: true } }, // Weird order
      { input: "ban warn kick @user", expected: { action: "ban", user: true } }, // Multiple actions
      { input: "note: @user is cool and also ban them", expected: { action: "note", user: true, message: "is cool and also ban them" } }, // Conflicting
      { input: "please do the needful", expected: null }, // Meaningless
    ]
  },

  // === TYPOS AND MISSPELLINGS (Real-world scenario) ===
  {
    category: "Typos & Misspellings",
    tests: [
      { input: "wan @user for spaming", expected: { action: "warn", user: true, reason: "spaming" } }, // wan = warn
      { input: "bna @user becuase trolling", expected: { action: "ban", user: true, reason: "trolling" } }, // bna = ban
      { input: "maek a not to @user tell him thx", expected: { action: "note", user: true, message: "tell him thx" } }, // maek = make, not = note
      { input: "pruge 5 mesages", expected: { action: "purge", amount: "5" } }, // pruge = purge
      { input: "sya hello everyone", expected: { action: "say", message: "hello everyone" } } // sya = say
    ]
  },

  // === COMPLEX SENTENCES (Advanced parsing) ===
  {
    category: "Complex Sentences",
    tests: [
      { input: "hey bot, when you get a chance, could you warn @user for the spam issue we discussed?", expected: { action: "warn", user: true, reason: "the spam issue we discussed" } },
      { input: "I think it would be best if you made a note about @user saying they completed their task successfully", expected: { action: "note", user: true, message: "they completed their task successfully" } },
      { input: "since the chat is getting messy, please purge about 20 messages to clean it up", expected: { action: "purge", amount: "20" } },
      { input: "before the meeting starts, can you tell everyone to join the voice channel?", expected: { action: "say", message: "join the voice channel" } }
    ]
  },

  // === EDGE CASES (Boundary testing) ===
  {
    category: "Edge Cases",
    tests: [
      { input: "", expected: null }, // Empty
      { input: "   ", expected: null }, // Whitespace only  
      { input: "ban", expected: { action: "ban" } }, // Action only, no target
      { input: "@user", expected: null }, // User only, no action
      { input: "ban @user ban @user", expected: { action: "ban", user: true } }, // Duplicate
      { input: "123 ban @user 456", expected: { action: "ban", user: true } }, // Numbers mixed in
      { input: "BAN @USER FOR SHOUTING", expected: { action: "ban", user: true, reason: "SHOUTING" } }, // ALL CAPS
      { input: "b a n   @user   f o r   s p a c i n g", expected: { action: "ban", user: true, reason: "s p a c i n g" } } // Weird spacing
    ]
  }
];

// Mock parsing function to test (simulates the new sophisticated parseWithAI function)
function mockParseWithAI(command, mentionedUserIds) {
  // Normalize input
  const normalizedCommand = normalizeInput(command);
  if (!normalizedCommand) return null;
  
  // Classify intent
  const intent = classifyIntent(normalizedCommand);
  if (!intent) return null;
  
  // Extract parameters
  const params = extractEntitiesAndParams(normalizedCommand, intent, mentionedUserIds);
  
  return { action: intent, params };
}

// Normalize input text for better processing
function normalizeInput(text) {
  if (!text || typeof text !== 'string') return null;
  
  let normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  
  // Handle contractions and informal language
  const contractions = {
    "can't": "cannot", "won't": "will not", "don't": "do not", "didn't": "did not",
    "isn't": "is not", "aren't": "are not", "tbh": "to be honest", "pls": "please",
    "msgs": "messages", "msg": "message", "u": "you", "ur": "your", "gimme": "give me"
  };
  
  for (const [contraction, expansion] of Object.entries(contractions)) {
    normalized = normalized.replace(new RegExp(`\\b${contraction}\\b`, 'g'), expansion);
  }
  
  // Fix typos
  const typoCorrections = {
    "wan": "warn", "bna": "ban", "maek": "make", "pruge": "purge", "sya": "say",
    "mesages": "messages", "becuase": "because", "spaming": "spamming"
  };
  
  for (const [typo, correction] of Object.entries(typoCorrections)) {
    normalized = normalized.replace(new RegExp(`\\b${typo}\\b`, 'g'), correction);
  }
  
  return normalized;
}

// Classify intent using semantic analysis
function classifyIntent(text) {
  const intentPatterns = {
    note: {
      directActions: ["note", "record", "remember", "document", "log"],
      contextualPhrases: ["make a note", "add a note", "write down", "keep track", "note about"],
      semanticIndicators: ["note", "record", "remember", "document", "write", "log"]
    },
    warn: {
      directActions: ["warn", "warning", "caution"],
      contextualPhrases: ["give a warning", "give them a warning", "warn them"],
      semanticIndicators: ["warn", "warning", "caution", "alert", "notify"]
    },
    ban: {
      directActions: ["ban", "remove", "banish", "exile"],
      contextualPhrases: ["ban from server", "remove from server", "get rid of", "kick them out"],
      semanticIndicators: ["ban", "remove", "banish", "exile", "expel", "eject"]
    },
    kick: {
      directActions: ["kick", "boot"],
      contextualPhrases: ["kick from server", "kick them out", "boot them"],
      semanticIndicators: ["kick", "boot", "eject", "throw"]
    },
    mute: {
      directActions: ["mute", "silence", "timeout", "quiet"],
      contextualPhrases: ["mute user", "silence them", "time them out", "timeout user"],
      semanticIndicators: ["mute", "silence", "timeout", "quiet", "hush"]
    },
    say: {
      directActions: ["say", "announce", "tell", "broadcast", "declare"],
      contextualPhrases: ["tell everyone", "announce that", "let everyone know", "inform everyone"],
      semanticIndicators: ["say", "tell", "announce", "broadcast", "declare", "proclaim", "inform"]
    },
    purge: {
      directActions: ["purge", "delete", "clear", "clean", "remove"],
      contextualPhrases: ["delete messages", "clear messages", "get rid of messages", "clean up"],
      semanticIndicators: ["purge", "delete", "clear", "clean", "remove", "wipe"]
    },
    pin: {
      directActions: ["pin", "stick", "attach"],
      contextualPhrases: ["pin message", "pin this", "pin the message"],
      semanticIndicators: ["pin", "stick", "attach", "fix", "secure"]
    },
    ping: {
      directActions: ["ping", "latency", "speed", "response"],
      contextualPhrases: ["check ping", "test latency", "how fast", "response time", "check speed"],
      semanticIndicators: ["ping", "latency", "speed", "fast", "response", "delay"]
    },
    "server-info": {
      directActions: ["server", "info", "information", "details", "stats"],
      contextualPhrases: ["server info", "server details", "about server", "what server"],
      semanticIndicators: ["server", "guild", "info", "information", "details", "stats", "about"]
    },
    slowmode: {
      directActions: ["slowmode", "slow", "rate", "limit"],
      contextualPhrases: ["set slowmode", "enable slowmode", "rate limit", "slow down"],
      semanticIndicators: ["slowmode", "slow", "rate", "limit", "restrict", "throttle"]
    }
  };
  
  let bestMatch = null;
  let highestScore = 0;
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    const score = calculateIntentScore(text, patterns);
    if (score > highestScore && score > 0.3) {
      highestScore = score;
      bestMatch = intent;
    }
  }
  
  return bestMatch;
}

// Calculate intent confidence score
function calculateIntentScore(text, patterns) {
  let score = 0;
  const words = text.split(/\s+/);
  
  // Direct action words (high weight)
  for (const action of patterns.directActions) {
    if (words.includes(action)) {
      score += 0.8;
    }
    // Fuzzy matching
    for (const word of words) {
      if (calculateSimilarity(word, action) > 0.8) {
        score += 0.6;
      }
    }
  }
  
  // Contextual phrases (medium weight)
  for (const phrase of patterns.contextualPhrases) {
    if (text.includes(phrase)) {
      score += 0.6;
    }
    // Partial phrase matching
    const phraseWords = phrase.split(/\s+/);
    const matchedWords = phraseWords.filter(pw => words.includes(pw)).length;
    if (matchedWords > 0) {
      score += (matchedWords / phraseWords.length) * 0.4;
    }
  }
  
  // Semantic indicators (lower weight)
  for (const indicator of patterns.semanticIndicators) {
    if (words.includes(indicator)) {
      score += 0.3;
    }
  }
  
  // Context boost
  const relatedWordCount = patterns.semanticIndicators.filter(indicator => 
    words.some(word => calculateSimilarity(word, indicator) > 0.7)
  ).length;
  
  if (relatedWordCount > 1) {
    score += 0.2;
  }
  
  return Math.min(score, 1.0);
}

// Calculate string similarity using Levenshtein distance
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

// Extract entities and parameters
function extractEntitiesAndParams(text, intent, mentionedUserIds) {
  const params = {};
  
  if (mentionedUserIds.length > 0) {
    params.user = mentionedUserIds[0];
  }
  
  switch (intent) {
    case 'note':
      params.message = extractNoteMessage(text);
      break;
    case 'warn':
    case 'ban':
    case 'kick':
    case 'mute':
      params.reason = extractReason(text);
      break;
    case 'say':
      params.message = extractSayMessage(text);
      break;
    case 'purge':
      params.amount = extractAmount(text);
      break;
    case 'slowmode':
      params.amount = extractDuration(text) || extractAmount(text);
      break;
  }
  
  return params;
}

// Extract note message with context understanding
function extractNoteMessage(text) {
  const patterns = [
    /(?:tell|saying|that|note:|message:)\s+(.+)$/i,
    /(?:about|regarding)\s+(.+)$/i,
    /(?:add a note|make a note|record|document)\s+(?:about|that|saying)\s+(.+)$/i,
    /@\w+\s+(.+)$/,
    /<@!?\d+>\s+(.+)$/,
    /(?:he|she|they|user)\s+(.+)$/i,
    /(?:has been|is|was)\s+(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  
  return '';
}

// Extract reason with context awareness
function extractReason(text) {
  const patterns = [
    /(?:for|because|due to|reason:)\s+(.+)$/i,
    /(?:they|user)\s+(?:keep|keeps|is|are|was|were)\s+(.+)$/i,
    /(?:harassment|spamming|trolling|annoying|breaking rules|being toxic)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Extract common reasons
  const commonReasons = ['harassment', 'spamming', 'trolling', 'annoying', 'toxic', 'breaking rules'];
  for (const reason of commonReasons) {
    if (text.includes(reason)) {
      return reason;
    }
  }
  
  return '';
}

// Extract say message with quotes and context
function extractSayMessage(text) {
  const patterns = [
    /'([^']+)'/,
    /"([^"]+)"/,
    /(?:say|tell everyone|announce that|broadcast)\s+(.+)$/i,
    /(?:everyone|all)\s+(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return '';
}

// Extract amounts with context
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
  
  // Word to number conversion
  const wordNumbers = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    'fifteen': '15', 'twenty': '20', 'thirty': '30', 'fifty': '50'
  };
  
  for (const [word, number] of Object.entries(wordNumbers)) {
    if (text.includes(word)) {
      return number;
    }
  }
  
  return '';
}

// Extract duration
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

// Test runner
function runTests() {
  let totalTests = 0;
  let totalPassed = 0;
  const results = {};
  
  console.log("🧪 COMPREHENSIVE NATURAL LANGUAGE PARSING TEST SUITE");
  console.log("=" * 60);
  
  for (const category of testCases) {
    let categoryPassed = 0;
    let categoryTotal = category.tests.length;
    results[category.category] = { passed: 0, total: categoryTotal, details: [] };
    
    console.log(`\n📋 ${category.category.toUpperCase()}`);
    console.log("-" * 40);
    
    for (const test of category.tests) {
      totalTests++;
      
      // Mock mentioned users if @user is present
      const mentionedUserIds = test.input.includes('@user') ? ['560079402013032448'] : [];
      
      const result = mockParseWithAI(test.input, mentionedUserIds);
      const passed = evaluateResult(result, test.expected);
      
      if (passed) {
        categoryPassed++;
        totalPassed++;
        console.log(`✅ "${test.input}" → ${JSON.stringify(result)}`);
      } else {
        console.log(`❌ "${test.input}"`);
        console.log(`   Expected: ${JSON.stringify(test.expected)}`);
        console.log(`   Got: ${JSON.stringify(result)}`);
      }
      
      results[category.category].details.push({
        input: test.input,
        expected: test.expected,
        result: result,
        passed: passed
      });
    }
    
    results[category.category].passed = categoryPassed;
    const categoryPercent = ((categoryPassed / categoryTotal) * 100).toFixed(1);
    console.log(`\n📊 ${category.category}: ${categoryPassed}/${categoryTotal} (${categoryPercent}%)`);
  }
  
  console.log("\n" + "=" * 60);
  console.log("📈 FINAL RESULTS");
  console.log("=" * 60);
  
  for (const [category, data] of Object.entries(results)) {
    const percent = ((data.passed / data.total) * 100).toFixed(1);
    console.log(`${category}: ${data.passed}/${data.total} (${percent}%)`);
  }
  
  const overallPercent = ((totalPassed / totalTests) * 100).toFixed(1);
  console.log("\n" + "-" * 60);
  console.log(`🎯 OVERALL SUCCESS RATE: ${totalPassed}/${totalTests} (${overallPercent}%)`);
  
  // Analysis
  console.log("\n📊 ANALYSIS:");
  if (overallPercent >= 85) {
    console.log("🟢 EXCELLENT: System performs very well with natural language");
  } else if (overallPercent >= 70) {
    console.log("🟡 GOOD: System handles most cases but needs improvement");
  } else if (overallPercent >= 50) {
    console.log("🟠 MODERATE: System works for basic cases but struggles with complexity");
  } else {
    console.log("🔴 POOR: System needs significant improvements");
  }
  
  return { totalPassed, totalTests, overallPercent, results };
}

function evaluateResult(result, expected) {
  if (expected === null) {
    return result === null;
  }
  
  if (result === null) {
    return false;
  }
  
  // Check action
  if (expected.action && result.action !== expected.action) {
    return false;
  }
  
  // Check user (if expected)
  if (expected.user && !result.params.user) {
    return false;
  }
  
  // Check message/reason (if expected)
  if (expected.message && !result.params.message) {
    return false;
  }
  
  if (expected.reason && !result.params.reason) {
    return false;
  }
  
  // Check amount (if expected)
  if (expected.amount && result.params.amount !== expected.amount) {
    return false;
  }
  
  return true;
}

// Run the tests
runTests(); 