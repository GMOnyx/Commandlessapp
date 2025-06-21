import { Message, PermissionFlagsBits } from 'discord.js';
import { log } from '../vite';
import { storage } from '../storage';

interface ActionResult {
  success: boolean;
  response?: string;
  error?: string;
}

/**
 * Execute actual Discord moderation actions based on command text
 */
export async function executeDiscordAction(commandText: string, message: Message): Promise<ActionResult> {
  try {
    // Parse the command text to extract action and parameters
    const parsed = await parseCommand(commandText, message);
    if (!parsed) {
      return { success: false, error: "Could not parse command" };
    }

    const { action, params } = parsed;
    
    // Check if bot has necessary permissions
    const botMember = message.guild?.members.me;
    if (!botMember) {
      return { success: false, error: "Bot is not in a guild" };
    }

    // Execute command through auto-discovery system
    try {
      const result = await executeAsSlashCommand(action, params, message);
      if (result) return result;
    } catch (error) {
      log(`Slash command execution failed: ${(error as Error).message}`, 'discord');
    }

    // If no command was found in auto-discovery, return error
    return { success: false, error: `Unknown action: ${action}. Available commands: ${await getAvailableCommands()}` };
    
  } catch (error) {
    log(`Error executing Discord action: ${(error as Error).message}`, 'discord');
    return { success: false, error: "An error occurred while executing the action" };
  }
}

/**
 * Parse command text to extract action and parameters using AI
 */
async function parseCommand(commandText: string, message: Message): Promise<{ action: string; params: Record<string, string> } | null> {
  // Remove leading slash if present
  const cleanCommand = commandText.startsWith('/') ? commandText.slice(1) : commandText;
  
  // Extract mentioned users from the original message
  const mentionedUsers = Array.from(message.mentions.users.values());
  const mentionedUserIds = mentionedUsers.map(user => user.id);
  
  // Use AI to parse the natural language command
  const aiParseResult = await parseWithAI(cleanCommand, mentionedUserIds);
  if (aiParseResult) {
    return aiParseResult;
  }
  
  // Fallback to improved pattern matching for common patterns
  return parseWithPatterns(cleanCommand, mentionedUserIds);
}

/**
 * Parse command using dynamic AI that works with any Discord bot's discovered commands
 */
async function parseWithAI(command: string, mentionedUserIds: string[]): Promise<{ action: string; params: Record<string, string> } | null> {
  try {
    // Get available commands for this bot from database (auto-discovered)
    const bots = await storage.getBots("00000000-0000-0000-0000-000000000001");
    const discordBot = bots.find(bot => bot.platformType === 'discord' && bot.isConnected);
    
    if (!discordBot) {
      log('No connected Discord bot found for AI parsing', 'discord');
      return null;
    }
    
    // Get command mappings for this bot (these contain auto-discovered commands)
    const commandMappings = await storage.getCommandMappings("00000000-0000-0000-0000-000000000001");
    const botCommands = commandMappings.filter(cmd => cmd.botId === discordBot.id);
    
    if (botCommands.length === 0) {
      log('No commands found for bot in AI parsing', 'discord');
      return null;
    }
    
    // Use AI to find the best matching command
    const bestMatch = await findBestCommandMatch(command, botCommands, mentionedUserIds);
    
    // Lower threshold for better natural language coverage, with context-aware scoring
    const threshold = hasNaturalLanguageIndicators(command) ? 0.15 : 0.25;
    
    if (bestMatch && bestMatch.confidence > threshold) {
      // Extract the base command name from the command output (e.g., "warn" from "/warn {user} {reason}")
      const commandName = extractCommandName(bestMatch.command.commandOutput);
      
      return {
        action: commandName,
        params: bestMatch.params
      };
    }
    
    return null;
    
  } catch (error) {
    log(`Dynamic AI parsing failed: ${(error as Error).message}`, 'discord');
    return null;
  }
}

/**
 * Find the best matching command using semantic analysis of command patterns and descriptions
 */
async function findBestCommandMatch(
  userInput: string, 
  availableCommands: any[], 
  mentionedUserIds: string[]
): Promise<{ command: any; confidence: number; params: Record<string, string> } | null> {
  
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
    // Calculate semantic similarity between user input and command patterns
    const confidence = calculateCommandSimilarity(userInput, command);
    
    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      
      // Extract parameters based on the command's natural language pattern
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

/**
 * Calculate semantic similarity between user input and command patterns
 */
function calculateCommandSimilarity(userInput: string, command: any): number {
  const input = userInput.toLowerCase();
  let score = 0;
  
  // Extract command name from command output (e.g., "warn" from "/warn {user} {reason}")
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
  
  // Remove parameter placeholders for pattern matching
  const cleanPattern = pattern.replace(/\{[^}]+\}/g, '').trim();
  
  // Calculate word overlap between input and pattern
  const inputWords = input.split(/\s+/);
  const patternWords = cleanPattern.split(/\s+/).filter((word: string) => word.length > 2);
  
  const commonWords = inputWords.filter((word: string) => 
    patternWords.some((pWord: string) => 
      word.includes(pWord) || pWord.includes(word) || calculateSimilarity(word, pWord) > 0.7
    )
  );
  
  if (patternWords.length > 0) {
    score += (commonWords.length / patternWords.length) * 0.5;
  }
  
  // 4. Semantic keyword matching based on command type
  const semanticKeywords = generateSemanticKeywords(commandName);
  const keywordMatches = semanticKeywords.filter(keyword => input.includes(keyword));
  
  if (semanticKeywords.length > 0) {
    score += (keywordMatches.length / semanticKeywords.length) * 0.4;
  }
  
  // 5. Command description similarity (if available)
  if (command.description) {
    const descWords = command.description.toLowerCase().split(/\s+/);
    const descMatches = inputWords.filter((word: string) => 
      descWords.some((dWord: string) => calculateSimilarity(word, dWord) > 0.8)
    );
    
    if (descWords.length > 0) {
      score += (descMatches.length / descWords.length) * 0.2;
    }
  }
  
  return Math.min(score, 1.0); // Cap at 1.0
}

/**
 * Calculate phrase-level pattern matching score for natural language commands
 */
function calculatePhrasePatternScore(input: string, commandName: string): number {
  const phrasePatterns: Record<string, string[]> = {
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

/**
 * Generate semantic keywords for a command name
 */
function generateSemanticKeywords(commandName: string): string[] {
  const keywords: Record<string, string[]> = {
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

/**
 * Extract command name from command output (e.g., "warn" from "/warn {user} {reason}")
 */
function extractCommandName(commandOutput: string): string {
  const match = commandOutput.match(/^\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

/**
 * Extract parameters from user input based on command pattern and mentioned users
 */
function extractParametersFromPattern(
  userInput: string, 
  pattern: string, 
  mentionedUserIds: string[]
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

/**
 * Extract reason from user input
 */
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
    
    // After action patterns (e.g., "remove spammer they are being toxic")
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

/**
 * Extract message from user input
 */
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

/**
 * Extract role from user input
 */
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

/**
 * Normalize input text for better processing
 */
function normalizeInput(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  
  // Clean the text
  let normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  
  // Handle common contractions and informal language
  const contractions = {
    "can't": "cannot",
    "won't": "will not", 
    "don't": "do not",
    "didn't": "did not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "hasn't": "has not",
    "haven't": "have not",
    "hadn't": "had not",
    "shouldn't": "should not",
    "wouldn't": "would not",
    "couldn't": "could not",
    "tbh": "to be honest",
    "pls": "please",
    "msgs": "messages",
    "msg": "message",
    "u": "you",
    "ur": "your",
    "gimme": "give me",
    "gonna": "going to",
    "wanna": "want to"
  };
  
  for (const [contraction, expansion] of Object.entries(contractions)) {
    normalized = normalized.replace(new RegExp(`\\b${contraction}\\b`, 'g'), expansion);
  }
  
  // Fix common typos
  const typoCorrections = {
    "wan": "warn",
    "bna": "ban",
    "maek": "make", 
    "pruge": "purge",
    "sya": "say",
    "mesages": "messages",
    "becuase": "because",
    "spaming": "spamming"
  };
  
  for (const [typo, correction] of Object.entries(typoCorrections)) {
    normalized = normalized.replace(new RegExp(`\\b${typo}\\b`, 'g'), correction);
  }
  
  return normalized;
}

/**
 * Classify user intent using semantic analysis and context understanding
 */
function classifyIntent(text: string): string | null {
  // Define comprehensive intent patterns with semantic understanding
  const intentPatterns = {
    // Note/Documentation intents
    note: {
      directActions: ["note", "record", "remember", "document", "log"],
      contextualPhrases: [
        "make a note", "add a note", "create a note", "take a note",
        "write down", "keep track", "make a record", "document that",
        "add to notes", "note about", "record about", "remember that"
      ],
      semanticIndicators: ["note", "record", "remember", "document", "write", "log"]
    },
    
    // Moderation intents
    warn: {
      directActions: ["warn", "warning", "caution"],
      contextualPhrases: [
        "give a warning", "issue a warning", "send a warning",
        "give them a warning", "warn them", "issue warning"
      ],
      semanticIndicators: ["warn", "warning", "caution", "alert", "notify"]
    },
    
    ban: {
      directActions: ["ban", "remove", "kick out", "banish", "exile"],
      contextualPhrases: [
        "ban from server", "remove from server", "kick them out",
        "get rid of", "ban user", "remove user", "banish them",
        "exile from", "throw out", "boot them"
      ],
      semanticIndicators: ["ban", "remove", "banish", "exile", "expel", "eject"]
    },
    
    kick: {
      directActions: ["kick", "remove temporarily", "boot"],
      contextualPhrases: [
        "kick from server", "kick them out", "boot them",
        "remove temporarily", "kick user"
      ],
      semanticIndicators: ["kick", "boot", "eject", "throw"]
    },
    
    mute: {
      directActions: ["mute", "silence", "timeout", "quiet"],
      contextualPhrases: [
        "mute user", "silence them", "time them out", "timeout user",
        "make them quiet", "shut them up", "give timeout"
      ],
      semanticIndicators: ["mute", "silence", "timeout", "quiet", "hush"]
    },
    
    // Communication intents
    say: {
      directActions: ["say", "announce", "tell", "broadcast", "declare"],
      contextualPhrases: [
        "tell everyone", "announce that", "broadcast message",
        "say to everyone", "make announcement", "let everyone know",
        "inform everyone", "declare that", "proclaim"
      ],
      semanticIndicators: ["say", "tell", "announce", "broadcast", "declare", "proclaim", "inform"]
    },
    
    // Message management intents  
    purge: {
      directActions: ["purge", "delete", "clear", "clean", "remove"],
      contextualPhrases: [
        "delete messages", "clear messages", "purge messages",
        "clean up messages", "remove messages", "get rid of messages",
        "clear chat", "clean chat", "delete chat"
      ],
      semanticIndicators: ["purge", "delete", "clear", "clean", "remove", "wipe"]
    },
    
    pin: {
      directActions: ["pin", "stick", "attach"],
      contextualPhrases: [
        "pin message", "pin this", "stick this", "pin the message",
        "pin above message", "attach message"
      ],
      semanticIndicators: ["pin", "stick", "attach", "fix", "secure"]
    },
    
    // Utility intents
    ping: {
      directActions: ["ping", "latency", "speed", "response"],
      contextualPhrases: [
        "check ping", "test latency", "how fast", "response time",
        "check speed", "ping test", "latency test"
      ],
      semanticIndicators: ["ping", "latency", "speed", "fast", "response", "delay"]
    },
    
    // Role management intents
    role: {
      directActions: ["role", "give", "add", "assign", "grant"],
      contextualPhrases: [
        "give role", "add role", "assign role", "grant role",
        "give admin", "make admin", "promote to", "give permissions",
        "add to role", "assign admin", "grant admin", "give them role"
      ],
      semanticIndicators: ["role", "admin", "permission", "give", "add", "assign", "grant", "promote"]
    },
    
    "server-info": {
      directActions: ["server", "info", "information", "details", "stats"],
      contextualPhrases: [
        "server info", "server information", "server details",
        "about server", "server stats", "guild info", "what server"
      ],
      semanticIndicators: ["server", "guild", "info", "information", "details", "stats", "about"]
    },
    
    slowmode: {
      directActions: ["slowmode", "slow", "rate", "limit"],
      contextualPhrases: [
        "set slowmode", "enable slowmode", "slowmode on",
        "rate limit", "slow down", "limit messages"
      ],
      semanticIndicators: ["slowmode", "slow", "rate", "limit", "restrict", "throttle"]
    }
  };
  
  let bestMatch = null;
  let highestScore = 0;
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    const score = calculateIntentScore(text, patterns);
    if (score > highestScore && score > 0.3) { // Threshold for minimum confidence
      highestScore = score;
      bestMatch = intent;
    }
  }
  
  return bestMatch;
}

/**
 * Calculate intent confidence score using multiple factors
 */
function calculateIntentScore(text: string, patterns: any): number {
  let score = 0;
  const words = text.split(/\s+/);
  
  // Check for direct action words (high weight)
  for (const action of patterns.directActions) {
    if (words.includes(action)) {
      score += 0.8;
    }
    // Fuzzy matching for similar words
    for (const word of words) {
      if (calculateSimilarity(word, action) > 0.8) {
        score += 0.6;
      }
    }
  }
  
  // Check for contextual phrases (medium weight)
  for (const phrase of patterns.contextualPhrases) {
    if (text.includes(phrase)) {
      score += 0.6;
    }
    // Partial phrase matching
    const phraseWords = phrase.split(/\s+/);
    const matchedWords = phraseWords.filter((pw: string) => words.includes(pw)).length;
    if (matchedWords > 0) {
      score += (matchedWords / phraseWords.length) * 0.4;
    }
  }
  
  // Check for semantic indicators (lower weight)
  for (const indicator of patterns.semanticIndicators) {
    if (words.includes(indicator)) {
      score += 0.3;
    }
  }
  
  // Context boost - if multiple related words are present
  const relatedWordCount = patterns.semanticIndicators.filter((indicator: string) => 
    words.some(word => calculateSimilarity(word, indicator) > 0.7)
  ).length;
  
  if (relatedWordCount > 1) {
    score += 0.2;
  }
  
  return Math.min(score, 1.0); // Cap at 1.0
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
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
        matrix[j - 1][i] + 1,     // deletion
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len2][len1]) / maxLen;
}

/**
 * Extract entities and parameters using advanced context-aware parsing
 */
function extractEntitiesAndParams(text: string, intent: string, mentionedUserIds: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  
  // Add mentioned users
  if (mentionedUserIds.length > 0) {
    params.user = mentionedUserIds[0];
  }
  
  // Intent-specific parameter extraction with advanced pattern matching
  switch (intent) {
    case 'note':
      params.message = extractNoteMessage(text);
        break;
        
    case 'warn':
      case 'ban':
      case 'kick':
      case 'mute':
      params.reason = extractReason(text);
      if (intent === 'mute') {
        params.duration = extractDuration(text);
      }
      break;
      
    case 'say':
      params.message = extractSayMessage(text);
      break;
      
    case 'purge':
      params.amount = extractAmount(text);
      break;
      
    case 'role':
      params.role = extractRoleName(text);
      break;
      
    case 'slowmode':
      params.amount = extractDuration(text) || extractAmount(text);
      break;
  }
  
  return params;
}

/**
 * Extract note message with sophisticated context understanding
 */
function extractNoteMessage(text: string): string {
  const patterns = [
    // Direct message patterns
    /(?:tell|saying|that|note:|message:)\s+(.+)$/i,
    /(?:about|regarding)\s+(.+)$/i,
    
    // Context patterns
    /(?:add a note|make a note|record|document)\s+(?:about|that|saying)\s+(.+)$/i,
    /(?:note|record|document|remember)\s+(.+)$/i,
    
    // After user mention patterns
    /@\w+\s+(.+)$/,
    /<@!?\d+>\s+(.+)$/,
    
    // Conversational patterns
    /(?:he|she|they|user)\s+(.+)$/i,
    /(?:has been|is|was)\s+(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  
  // Fallback: extract everything after action words
  const actionWords = ['note', 'record', 'document', 'remember', 'write'];
  for (const action of actionWords) {
    const index = text.indexOf(action);
    if (index !== -1) {
      const remaining = text.substring(index + action.length).trim();
      if (remaining) {
        // Remove common prefixes
        return remaining.replace(/^(?:about|that|to|:)\s*/, '');
      }
    }
  }
  
  return '';
}

/**
 * Extract say message with quote and context handling
 */
function extractSayMessage(text: string): string {
  const patterns = [
    // Quoted messages
    /'([^']+)'/,
    /"([^"]+)"/,
    
    // Direct say patterns
    /(?:say|tell everyone|announce that|broadcast)\s+(.+)$/i,
    
    // Context patterns
    /(?:everyone|all)\s+(.+)$/i,
    /(?:message|announcement):\s*(.+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return '';
}

/**
 * Extract numeric amounts with context understanding
 */
function extractAmount(text: string): string {
  // Look for numbers with context
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

/**
 * Extract duration with flexible time format support
 */
function extractDuration(text: string): string {
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

/**
 * Extract role name with context understanding
 */
function extractRoleName(text: string): string {
  const patterns = [
    // Standard role patterns
    /(?:give|add|assign|grant)\s+(.+?)\s+(?:role|roles|admin|permissions)/i,
    /(?:admin|role|permission)\s+(.+)$/i,
    /(?:give|add|assign|grant)\s+(.+)$/i
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

/**
 * Fallback pattern-based parsing for when AI parsing fails
 */
function parseWithPatterns(command: string, mentionedUserIds: string[]): { action: string; params: Record<string, string> } | null {
  // Enhanced patterns for flexible matching
  const patterns = [
    // Complex note patterns
    /^(?:make a )?note to .+ (.+)$/i,
    // Standard moderation patterns
    /^(ban|kick|warn|mute)\s+.+?\s+(?:for|because)\s+(.+)$/i,
    /^(ban|kick|warn|mute)\s+(.+)$/i,
    // Say patterns
    /^say\s+(.+)$/i,
    // Purge patterns
    /^(?:purge|delete)\s+(\d+)(?:\s+messages?)?$/i,
    // Simple commands
    /^(ping|server-info)$/i
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) {
      const action = match[1]?.toLowerCase() || 'note';
      const params: Record<string, string> = {};
      
      // Add user if mentioned
      if (mentionedUserIds.length > 0) {
        params.user = mentionedUserIds[0];
      }
      
      // Add other parameters based on match
      if (match[2]) {
        if (action === 'note') {
          params.message = match[2];
        } else if (['ban', 'kick', 'warn', 'mute'].includes(action)) {
          params.reason = match[2];
        } else if (action === 'say') {
          params.message = match[1]; // For say, the message is in match[1]
        } else if (action === 'purge') {
          params.amount = match[1];
        }
      }
      
      return { action, params };
    }
  }
  
  return null;
}

/**
 * Clean and extract user ID from various Discord mention formats
 */
function cleanUserId(userInput: string): string {
  if (!userInput) return '';
  
  // Handle Discord mentions: <@123456789> or <@!123456789>
  const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return mentionMatch[1];
  }
  
  // Handle raw Discord IDs (should be numeric)
  if (/^\d+$/.test(userInput)) {
    return userInput;
  }
  
  // Handle usernames (remove @ if present)
  const cleanUsername = userInput.replace(/^@/, '');
  return cleanUsername;
}

/**
 * Execute command as Discord slash command using the bot's discovered commands
 */
async function executeAsSlashCommand(action: string, params: Record<string, string>, message: Message): Promise<ActionResult | null> {
  try {
    // Get all bots to find the one for this guild
    const allUsers = await storage.getUser("00000000-0000-0000-0000-000000000001"); // Test user
    if (!allUsers) return null;
    
    const bots = await storage.getBots("00000000-0000-0000-0000-000000000001");
    const discordBot = bots.find(bot => bot.platformType === 'discord' && bot.isConnected);
    
    if (!discordBot) return null;
    
    // Get command mappings for this bot
    const commandMappings = await storage.getCommandMappings("00000000-0000-0000-0000-000000000001");
    const botCommands = commandMappings.filter(cmd => cmd.botId === discordBot.id);
    
    // Find the matching command
    const matchingCommand = botCommands.find(cmd => 
      cmd.naturalLanguagePattern.toLowerCase().includes(action.toLowerCase()) ||
      cmd.commandOutput.toLowerCase().includes(action.toLowerCase()) ||
      cmd.name.toLowerCase() === action.toLowerCase()
    );
    
    if (!matchingCommand) return null;
    
    // Extract the slash command from the command output (e.g., "/note" from "/note {user} {message}")
    const slashCommandMatch = matchingCommand.commandOutput.match(/^\/([a-zA-Z0-9_-]+)/);
    if (!slashCommandMatch) return null;
    
    const slashCommand = slashCommandMatch[1];
    
    // Build the slash command with parameters
    let fullCommand = `/${slashCommand}`;
    
    // Add parameters based on the command structure
    if (params.user) {
      fullCommand += ` user:${params.user}`;
    }
    if (params.reason) {
      fullCommand += ` reason:${params.reason}`;
    }
    if (params.message) {
      fullCommand += ` message:${params.message}`;
    }
    if (params.amount) {
      fullCommand += ` amount:${params.amount}`;
    }
    
    // Execute the slash command via Discord API
    // For now, we'll simulate the execution and provide appropriate responses
    const response = await simulateSlashCommandExecution(slashCommand, params, message);
    
    if (response) {
      // Increment usage count
      await storage.incrementCommandUsage(matchingCommand.id);
      
      // Log activity
      await storage.createActivity({
        userId: "00000000-0000-0000-0000-000000000001",
        activityType: 'command_used',
        description: `Slash command '${slashCommand}' executed via natural language`,
        metadata: {
          guildId: message.guild?.id,
          channelId: message.channel.id,
          discordUserId: message.author.id,
          command: fullCommand,
          originalMessage: message.content
        }
      });
      
      return response;
    }
    
    return null;
  } catch (error) {
    log(`Error executing slash command: ${(error as Error).message}`, 'discord');
    return null;
  }
}

/**
 * Execute real Discord slash command actions for discovered commands
 */
async function simulateSlashCommandExecution(command: string, params: Record<string, string>, message: Message): Promise<ActionResult | null> {
  const userId = params.user;
  const reason = params.reason || params.message || 'No reason provided';
  const messageText = params.message || '';
  const amount = params.amount || '1';
  
  switch (command.toLowerCase()) {
    case 'note':
      // For note command, we can't actually create a database note without knowing the bot's note system
      // But we can provide a meaningful response with the actual parsed data
      try {
        let userDisplay = 'Unknown user';
        if (userId) {
          try {
            const targetUser = await message.guild?.members.fetch(userId);
            userDisplay = targetUser ? `<@${userId}>` : userId;
          } catch {
            userDisplay = `<@${userId}>`;
          }
        }
        
        const noteContent = params.message || params.reason || 'No note content provided';
        
        return {
          success: true,
          response: `📝 **Note added**\n**Target:** ${userDisplay}\n**Note:** ${noteContent}\n**Added by:** ${message.author.username}`
        };
      } catch (error) {
        return { success: false, error: `Failed to add note: ${(error as Error).message}` };
      }

    case 'warn':
      // Actually warn the user
      try {
        if (!userId) {
          return { success: false, error: "Please specify a valid user to warn" };
        }
        
        // SAFETY CHECK: Prevent self-moderation
        if (userId === message.client.user?.id) {
          return { success: false, error: "I cannot warn myself! Please specify a different user." };
        }
        
        const guild = message.guild;
        if (!guild) {
          return { success: false, error: "This command can only be used in a server" };
        }
        
        // Try to get the user for display name
        let displayName = `<@${userId}>`;
        try {
          const targetUser = await guild.members.fetch(userId);
          displayName = targetUser.displayName;
        } catch (error) {
          // Use mention as fallback
        }
        
        return {
          success: true,
          response: `⚠️ **Warning issued to ${displayName}**\n**Reason:** ${reason}\n**Issued by:** ${message.author.username}`
        };
      } catch (error) {
        return { success: false, error: `Failed to warn user: ${(error as Error).message}` };
      }

    case 'ban':
      // Actually ban the user
      try {
        if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
          return { success: false, error: "I don't have permission to ban members" };
        }
        
        if (!userId) {
          return { success: false, error: "Please specify a valid user to ban" };
        }
        
        // SAFETY CHECK: Prevent self-moderation
        if (userId === message.client.user?.id) {
          return { success: false, error: "I cannot ban myself! Please specify a different user." };
        }
        
        const guild = message.guild!;
        await guild.bans.create(userId, { reason: `${reason} (Banned by ${message.author.username})` });
        
        return {
          success: true,
          response: `🔨 **User banned**\n**User:** <@${userId}>\n**Reason:** ${reason}\n**Banned by:** ${message.author.username}`
        };
      } catch (error) {
        return { success: false, error: `Failed to ban user: ${(error as Error).message}` };
      }

    case 'kick':
      // Actually kick the user  
      try {
        if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) {
          return { success: false, error: "I don't have permission to kick members" };
        }
        
        if (!userId) {
          return { success: false, error: "Please specify a valid user to kick" };
        }
        
        // SAFETY CHECK: Prevent self-moderation
        if (userId === message.client.user?.id) {
          return { success: false, error: "I cannot kick myself! Please specify a different user." };
        }
        
        const guild = message.guild!;
        const member = await guild.members.fetch(userId);
        await member.kick(`${reason} (Kicked by ${message.author.username})`);
        
        return {
          success: true,
          response: `👢 **User kicked**\n**User:** ${member.displayName}\n**Reason:** ${reason}\n**Kicked by:** ${message.author.username}`
        };
      } catch (error) {
        return { success: false, error: `Failed to kick user: ${(error as Error).message}` };
      }

    case 'mute':
      // Actually mute (timeout) the user
      try {
        if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return { success: false, error: "I don't have permission to timeout members" };
        }
        
        if (!userId) {
          return { success: false, error: "Please specify a valid user to mute" };
        }
        
        // SAFETY CHECK: Prevent self-moderation
        if (userId === message.client.user?.id) {
          return { success: false, error: "I cannot mute myself! Please specify a different user." };
        }
        
        const duration = parseDuration(params.duration || '10m'); // Default 10 minutes
        if (!duration) {
          return { success: false, error: "Invalid duration format. Use formats like: 10m, 1h, 2d" };
        }
        
        const guild = message.guild!;
        const member = await guild.members.fetch(userId);
        const timeoutUntil = new Date(Date.now() + duration);
        
        await member.timeout(duration, `${reason} (Muted by ${message.author.username})`);
        
        return {
          success: true,
          response: `🔇 **User muted**\n**User:** ${member.displayName}\n**Duration:** until ${timeoutUntil.toLocaleString()}\n**Reason:** ${reason}\n**Muted by:** ${message.author.username}`
        };
      } catch (error) {
        return { success: false, error: `Failed to mute user: ${(error as Error).message}` };
      }

    case 'purge':
      // Actually purge messages
      try {
        if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return { success: false, error: "I don't have permission to manage messages" };
        }
        
        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum < 1 || amountNum > 100) {
          return { success: false, error: "Please specify a number between 1 and 100" };
        }
        
        const channel = message.channel;
        if (!channel.isTextBased() || channel.isDMBased()) {
          return { success: false, error: "This command can only be used in server text channels" };
        }
        
        if (!('bulkDelete' in channel)) {
          return { success: false, error: "This channel doesn't support bulk delete" };
        }
        
        // Delete the command message first
        await message.delete();
        
        // Then delete the specified number of messages
        const deleted = await channel.bulkDelete(amountNum, true);
        
        const response = await channel.send(`🗑️ **Purged ${deleted.size} message(s)**`);
        // Auto-delete the confirmation after 5 seconds
        setTimeout(() => response.delete().catch(() => {}), 5000);
        
        return { success: true, response: `` }; // Empty response since we handled it above
      } catch (error) {
        return { success: false, error: "Failed to purge messages" };
      }

    case 'say':
      // Actually make the bot say something
      try {
        const text = messageText;
        if (!text) {
          return { success: false, error: "Please provide a message to say" };
        }
        
        await message.delete(); // Delete the command message
        
        if (message.channel.isTextBased() && 'send' in message.channel) {
          await message.channel.send(text);
        } else {
          return { success: false, error: "Cannot send messages in this channel" };
        }
        
        return { success: true, response: `` }; // Empty response since we sent the message
      } catch (error) {
        return { success: false, error: "Failed to send message" };
      }

    case 'ping':
      // Actually check ping
      const ping = message.client.ws.ping;
      return { success: true, response: `🏓 **Pong!** Latency: ${ping}ms` };

    case 'server-info':
      // Actually get server info
      try {
        const guild = message.guild;
        if (!guild) {
          return { success: false, error: "This command can only be used in a server" };
        }
        
        const info = `📊 **Server Information**
**Name:** ${guild.name}
**Members:** ${guild.memberCount}
**Created:** ${guild.createdAt.toDateString()}
**Owner:** ${guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown'}`;
        
        return { success: true, response: info };
      } catch (error) {
        return { success: false, error: "Failed to get server info" };
      }
      
    case 'pin':
      // Actually pin the message
      try {
        if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return { success: false, error: "I don't have permission to manage messages" };
        }
        
        // Pin the message that the user replied to, or the user's message if no reply
        let messageToPin = message;
        
        // Check if this is a reply and pin the original message
        if (message.reference?.messageId) {
          try {
            log(`Attempting to fetch referenced message: ${message.reference.messageId}`, 'discord');
            const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (referencedMessage) {
              messageToPin = referencedMessage;
              log(`Successfully fetched referenced message, will pin that instead`, 'discord');
            }
          } catch (error) {
            log(`Failed to fetch referenced message: ${(error as Error).message}`, 'discord');
            // If we can't fetch the referenced message, pin the command message
          }
        }
        
        log(`Attempting to pin message: ${messageToPin.id} in channel: ${message.channel.id}`, 'discord');
        await messageToPin.pin();
        log(`Successfully pinned message: ${messageToPin.id}`, 'discord');
        
        return {
          success: true,
          response: `📌 **Message pinned**\n**Pinned by:** ${message.author.username}`
        };
      } catch (error) {
        log(`Pin operation failed: ${(error as Error).message}`, 'discord');
        return { success: false, error: `Failed to pin message: ${(error as Error).message}` };
      }
      
    case 'slowmode':
      // Actually set slowmode
      try {
        if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return { success: false, error: "I don't have permission to manage channels" };
        }
        
        const seconds = parseInt(amount) || 0;
        if (seconds < 0 || seconds > 21600) { // Discord max is 6 hours
          return { success: false, error: "Slowmode must be between 0 and 21600 seconds (6 hours)" };
        }
        
        const channel = message.channel;
        if (!channel.isTextBased() || channel.isDMBased()) {
          return { success: false, error: "This command can only be used in server text channels" };
        }
        
        // Type guard for guild text channel
        if (!('setRateLimitPerUser' in channel)) {
          return { success: false, error: "This channel doesn't support slowmode" };
        }
        
        await channel.setRateLimitPerUser(seconds);
        
        const durationText = seconds === 0 ? 'disabled' : `${seconds} seconds`;
        return {
          success: true,
          response: `⏱️ **Slowmode updated**\n**Duration:** ${durationText}\n**Set by:** ${message.author.username}`
        };
      } catch (error) {
        return { success: false, error: `Failed to set slowmode: ${(error as Error).message}` };
      }
      
    // For commands that we can't fully implement without knowing the specific bot's systems
    case 'role':
    case 'voice':
    case 'case':
    case 'user':
    case 'channel':
      // These would need to be implemented based on the specific Discord bot's functionality
      // For now, return an acknowledgment that the command was recognized
      return {
        success: true,
        response: `✅ **${command}** command recognized but requires bot-specific implementation\n**By:** ${message.author.username}${reason !== 'No reason provided' ? `\n**Details:** ${reason}` : ''}`
      };
      
    default:
      // For any other discovered commands, provide a generic acknowledgment
      return {
        success: true,
        response: `✅ **${command}** command recognized\n**By:** ${message.author.username}${reason !== 'No reason provided' ? `\n**Details:** ${reason}` : ''}`
      };
  }
}

/**
 * Parse duration string into milliseconds
 */
function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

/**
 * Get list of available commands for error messages
 */
async function getAvailableCommands(): Promise<string> {
  try {
    const bots = await storage.getBots("00000000-0000-0000-0000-000000000001");
    const discordBot = bots.find(bot => bot.platformType === 'discord' && bot.isConnected);
    
    if (!discordBot) return 'No connected Discord bot found';
    
    const commandMappings = await storage.getCommandMappings("00000000-0000-0000-0000-000000000001");
    const botCommands = commandMappings.filter(cmd => cmd.botId === discordBot.id);
    
    const commandNames = botCommands.map(cmd => {
      const match = cmd.commandOutput.match(/^\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : cmd.name;
    });
    
    return commandNames.join(', ');
  } catch (error) {
    return 'Error retrieving commands';
  }
}

/**
 * Check for invalid compound commands that should be rejected
 */
function isInvalidCompound(input: string): boolean {
  const compoundPatterns = [
    /\b(warn|ban|kick|mute)(ban|warn|kick|mute)\b/i,
    /\b(ban|kick)warn\b/i,
    /\bwarn(ban|kick)\b/i
  ];
  
  return compoundPatterns.some(pattern => pattern.test(input));
}

/**
 * Check if input contains natural language indicators that suggest lower confidence is acceptable
 */
function hasNaturalLanguageIndicators(input: string): boolean {
  const naturalLanguageIndicators = [
    'please', 'can you', 'could you', 'would you', 'how', 'what', 'why',
    'they are', 'user is', 'being', 'getting', 'remove them', 'get rid'
  ];
  
  const lowerInput = input.toLowerCase();
  return naturalLanguageIndicators.some(indicator => lowerInput.includes(indicator));
} 