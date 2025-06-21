/**
 * Comprehensive Test Suite for Scalable Auto-Discovery Command Parsing
 * This tests the new dynamic system that works with ANY Discord bot
 */

import { storage } from './server/storage/index.js';

// Test categories covering various scenarios
const testCategories = {
  'Auto-Discovery Commands': [
    { input: '@bot warn @user123 for spamming', expected: { action: 'warn', params: { user: 'user123', reason: 'spamming' } } },
    { input: '@bot ban @toxic_user because harassment', expected: { action: 'ban', params: { user: 'toxic_user', reason: 'harassment' } } },
    { input: '@bot kick @annoying_user they keep trolling', expected: { action: 'kick', params: { user: 'annoying_user', reason: 'they keep trolling' } } },
    { input: '@bot mute @spammer for 1 hour', expected: { action: 'mute', params: { user: 'spammer', duration: '1 hour' } } },
    { input: '@bot note to @user remember they helped yesterday', expected: { action: 'note', params: { user: 'user', message: 'remember they helped yesterday' } } },
    { input: '@bot say "Hello everyone!"', expected: { action: 'say', params: { message: 'Hello everyone!' } } },
    { input: '@bot purge 10 messages', expected: { action: 'purge', params: { amount: '10' } } },
    { input: '@bot ping check latency', expected: { action: 'ping', params: {} } }
  ],

  'Natural Language Variations': [
    { input: '@bot please give @user123 a warning for being rude', expected: { action: 'warn', params: { user: 'user123', reason: 'being rude' } } },
    { input: '@bot can you remove @spammer they are annoying', expected: { action: 'ban', params: { user: 'spammer', reason: 'they are annoying' } } },
    { input: '@bot silence @noisy_user for 30 minutes', expected: { action: 'mute', params: { user: 'noisy_user', duration: '30 minutes' } } },
    { input: '@bot tell everyone "Server maintenance tonight"', expected: { action: 'say', params: { message: 'Server maintenance tonight' } } },
    { input: '@bot clean up 25 messages from this channel', expected: { action: 'purge', params: { amount: '25' } } },
    { input: '@bot stick this message to the channel', expected: { action: 'pin', params: {} } },
    { input: '@bot how fast is your response time?', expected: { action: 'ping', params: {} } }
  ],

  'Informal & Slang': [
    { input: '@bot pls warn @baduser theyre being toxic af', expected: { action: 'warn', params: { user: 'baduser', reason: 'theyre being toxic af' } } },
    { input: '@bot yeet @troll outta here for harassment', expected: { action: 'ban', params: { user: 'troll', reason: 'harassment' } } },
    { input: '@bot shush @louduser for like 10 mins', expected: { action: 'mute', params: { user: 'louduser', duration: '10 mins' } } },
    { input: '@bot gimme ur ping stats', expected: { action: 'ping', params: {} } },
    { input: '@bot delete these msgs pls, like 5 of them', expected: { action: 'purge', params: { amount: '5' } } }
  ],

  'Complex Sentences': [
    { input: '@bot I think you should warn @problematic_user because they have been consistently breaking our server rules', expected: { action: 'warn', params: { user: 'problematic_user', reason: 'consistently breaking our server rules' } } },
    { input: '@bot would it be possible to temporarily mute @disruptive_user for about 2 hours since they keep interrupting conversations?', expected: { action: 'mute', params: { user: 'disruptive_user', duration: '2 hours', reason: 'keep interrupting conversations' } } },
    { input: '@bot could you please make an announcement saying "Welcome to our new members joining today!"', expected: { action: 'say', params: { message: 'Welcome to our new members joining today!' } } },
    { input: '@bot we need to clean this channel, can you purge the last 15 messages that are just spam?', expected: { action: 'purge', params: { amount: '15' } } }
  ],

  'Role Management': [
    { input: '@bot give @newuser admin role', expected: { action: 'role', params: { user: 'newuser', role: 'admin' } } },
    { input: '@bot add moderator permissions to @helper', expected: { action: 'role', params: { user: 'helper', role: 'moderator' } } },
    { input: '@bot assign vip role to @supporter', expected: { action: 'role', params: { user: 'supporter', role: 'vip' } } },
    { input: '@bot make @trusted member admin', expected: { action: 'role', params: { user: 'trusted', role: 'admin' } } }
  ],

  'Command Synonyms': [
    { input: '@bot timeout @user for 1 hour', expected: { action: 'mute', params: { user: 'user', duration: '1 hour' } } },
    { input: '@bot silence @spammer permanently', expected: { action: 'mute', params: { user: 'spammer', duration: 'permanently' } } },
    { input: '@bot boot @troublemaker for trolling', expected: { action: 'kick', params: { user: 'troublemaker', reason: 'trolling' } } },
    { input: '@bot eject @rulebreaker from server', expected: { action: 'kick', params: { user: 'rulebreaker' } } },
    { input: '@bot announce "Server reboot in 5 minutes"', expected: { action: 'say', params: { message: 'Server reboot in 5 minutes' } } },
    { input: '@bot broadcast important update', expected: { action: 'say', params: { message: 'important update' } } }
  ],

  'Edge Cases': [
    { input: '@bot', expected: null }, // Just mention
    { input: '@bot hello how are you?', expected: null }, // Conversational
    { input: '@bot warnban @user', expected: null }, // Invalid compound
    { input: '@bot warn', expected: null }, // Missing target
    { input: '@bot warn @user @anotheruser same time', expected: { action: 'warn', params: { user: 'user' } } }, // Multiple users
    { input: '@bot send message to @user saying hello', expected: { action: 'note', params: { user: 'user', message: 'hello' } } }, // Message to user
    { input: '@bot really long command with many words that might confuse the parser but should still work for warning @user', expected: { action: 'warn', params: { user: 'user' } } }
  ]
};

// Mock Discord bot and command mappings data
const mockBotData = {
  bot: {
    id: 7,
    userId: "00000000-0000-0000-0000-000000000001",
    platformType: 'discord',
    isConnected: true
  },
  commands: [
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
  ]
};

// Mock the parsing function (we'll import the real one later)
async function mockParseWithAI(input, mentionedUserIds) {
  // This would be replaced with the actual function from discordActionExecutor.ts
  console.log(`Parsing: "${input}" with users: [${mentionedUserIds.join(', ')}]`);
  
  // For now, return a mock result for demonstration
  // The real implementation will use the auto-discovery system
  return { action: 'warn', params: { user: mentionedUserIds[0] || 'user123', reason: 'test reason' } };
}

/**
 * Extract mentioned user IDs from test input
 */
function extractMentionedUsers(input) {
  const mentions = input.match(/@(\w+)/g);
  return mentions ? mentions.map(m => m.substring(1)).filter(user => user !== 'bot') : [];
}

/**
 * Compare expected vs actual results
 */
function compareResults(expected, actual, testName) {
  if (expected === null && actual === null) {
    return { pass: true, message: `✅ ${testName}: Correctly returned null` };
  }
  
  if (expected === null || actual === null) {
    return { pass: false, message: `❌ ${testName}: Expected ${expected}, got ${actual}` };
  }
  
  // Check action
  if (expected.action !== actual.action) {
    return { pass: false, message: `❌ ${testName}: Action mismatch. Expected "${expected.action}", got "${actual.action}"` };
  }
  
  // Check key parameters
  const keyParams = ['user', 'reason', 'message', 'amount', 'duration', 'role'];
  for (const param of keyParams) {
    if (expected.params[param] && !actual.params[param]) {
      return { pass: false, message: `❌ ${testName}: Missing parameter "${param}". Expected "${expected.params[param]}", got undefined` };
    }
    
    if (expected.params[param] && actual.params[param] && 
        !actual.params[param].toLowerCase().includes(expected.params[param].toLowerCase())) {
      return { pass: false, message: `❌ ${testName}: Parameter "${param}" mismatch. Expected "${expected.params[param]}", got "${actual.params[param]}"` };
    }
  }
  
  return { pass: true, message: `✅ ${testName}: All checks passed` };
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Scalable Auto-Discovery Command Parsing Tests\n');
  
  let totalTests = 0;
  let passedTests = 0;
  const results = {};
  
  for (const [category, tests] of Object.entries(testCategories)) {
    console.log(`\n📂 Testing Category: ${category}`);
    console.log('='.repeat(50));
    
    const categoryResults = [];
    let categoryPassed = 0;
    
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const testName = `${category} #${i + 1}`;
      totalTests++;
      
      try {
        // Extract mentioned users from input
        const mentionedUsers = extractMentionedUsers(test.input);
        
        // Parse with the new AI system
        const result = await mockParseWithAI(test.input, mentionedUsers);
        
        // Compare results
        const comparison = compareResults(test.expected, result, testName);
        categoryResults.push(comparison);
        
        if (comparison.pass) {
          passedTests++;
          categoryPassed++;
        }
        
        console.log(comparison.message);
        
      } catch (error) {
        const errorMsg = `❌ ${testName}: Error during parsing - ${error.message}`;
        categoryResults.push({ pass: false, message: errorMsg });
        console.log(errorMsg);
      }
    }
    
    const categoryScore = ((categoryPassed / tests.length) * 100).toFixed(1);
    console.log(`\n📊 ${category} Results: ${categoryPassed}/${tests.length} (${categoryScore}%)`);
    
    results[category] = {
      passed: categoryPassed,
      total: tests.length,
      percentage: categoryScore,
      details: categoryResults
    };
  }
  
  // Overall results
  const overallScore = ((passedTests / totalTests) * 100).toFixed(1);
  console.log('\n' + '='.repeat(70));
  console.log('🎯 OVERALL TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${overallScore}%`);
  
  // Category breakdown
  console.log('\n📈 Category Breakdown:');
  for (const [category, result] of Object.entries(results)) {
    console.log(`  ${category}: ${result.passed}/${result.total} (${result.percentage}%)`);
  }
  
  // Performance benchmark
  if (parseFloat(overallScore) >= 80) {
    console.log('\n🏆 EXCELLENT: System is production-ready!');
  } else if (parseFloat(overallScore) >= 70) {
    console.log('\n👍 GOOD: System works well, minor improvements needed');
  } else if (parseFloat(overallScore) >= 60) {
    console.log('\n⚠️  FAIR: System needs significant improvements');
  } else {
    console.log('\n🚨 POOR: System needs major rework');
  }
  
  return {
    totalTests,
    passedTests,
    overallScore: parseFloat(overallScore),
    categoryResults: results
  };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, testCategories, mockBotData }; 