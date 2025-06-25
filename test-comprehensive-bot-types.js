#!/usr/bin/env node

/**
 * Comprehensive Bot Type Testing Suite
 * Tests the system against multiple bot types and use cases
 */

import fetch from 'node-fetch';

// Configuration
const COMMANDLESS_API_URL = process.env.COMMANDLESS_API_URL || 'https://commandless-app-production.up.railway.app';
const TEST_BOT_ID = '1373685784779165776'; // Your test bot ID
const TEST_USER_ID = '560079402013032448'; // Your Discord user ID

// Test data for different bot types
const botTypeTests = {
  'MODERATION_BOT': {
    description: 'Testing moderation bot commands',
    commands: [
      // Standard moderation
      { input: '@bot ban @user for spamming', expected: 'ban', params: ['user', 'reason'] },
      { input: '@bot kick @user they are trolling', expected: 'kick', params: ['user', 'reason'] },
      { input: '@bot warn @user for being rude', expected: 'warn', params: ['user', 'reason'] },
      { input: '@bot mute @user for 10 minutes', expected: 'mute', params: ['user', 'duration'] },
      { input: '@bot timeout @user for 1 hour', expected: 'mute', params: ['user', 'duration'] },
      { input: '@bot purge 15 messages', expected: 'purge', params: ['amount'] },
      { input: '@bot pin this message', expected: 'pin', params: [] },
      
      // Natural language variations
      { input: '@bot please remove @user they are being toxic', expected: 'ban', params: ['user', 'reason'] },
      { input: '@bot can you silence @user for a bit', expected: 'mute', params: ['user'] },
      { input: '@bot delete the last 5 messages please', expected: 'purge', params: ['amount'] },
      { input: '@bot stick this message to the channel', expected: 'pin', params: [] },
      
      // Casual/informal
      { input: '@bot yeet @user outta here for spam', expected: 'ban', params: ['user', 'reason'] },
      { input: '@bot shush @user for like 30 mins', expected: 'mute', params: ['user', 'duration'] },
      { input: '@bot nuke 10 msgs', expected: 'purge', params: ['amount'] }
    ]
  },

  'MUSIC_BOT': {
    description: 'Testing music bot commands',
    commands: [
      // Basic music controls
      { input: '@bot play never gonna give you up', expected: 'play', params: ['song'] },
      { input: '@bot pause the music', expected: 'pause', params: [] },
      { input: '@bot resume playback', expected: 'resume', params: [] },
      { input: '@bot skip this song', expected: 'skip', params: [] },
      { input: '@bot stop playing music', expected: 'stop', params: [] },
      { input: '@bot set volume to 50', expected: 'volume', params: ['level'] },
      { input: '@bot show the queue', expected: 'queue', params: [] },
      { input: '@bot shuffle the playlist', expected: 'shuffle', params: [] },
      { input: '@bot loop this song', expected: 'loop', params: [] },
      { input: '@bot disconnect from voice', expected: 'disconnect', params: [] },
      
      // Natural variations
      { input: '@bot start playing some music', expected: 'play', params: [] },
      { input: '@bot turn up the volume', expected: 'volume', params: [] },
      { input: '@bot next song please', expected: 'skip', params: [] },
      { input: '@bot what songs are coming up', expected: 'queue', params: [] },
      { input: '@bot make it louder', expected: 'volume', params: [] },
      { input: '@bot put on some tunes', expected: 'play', params: [] },
      
      // Specific requests
      { input: '@bot play https://youtube.com/watch?v=dQw4w9WgXcQ', expected: 'play', params: ['url'] },
      { input: '@bot add this to queue: despacito', expected: 'play', params: ['song'] },
      { input: '@bot remove song 3 from queue', expected: 'remove', params: ['position'] }
    ]
  },

  'UTILITY_BOT': {
    description: 'Testing utility bot commands',
    commands: [
      // Server info
      { input: '@bot server info', expected: 'serverinfo', params: [] },
      { input: '@bot user info @user', expected: 'userinfo', params: ['user'] },
      { input: '@bot avatar @user', expected: 'avatar', params: ['user'] },
      { input: '@bot ping check', expected: 'ping', params: [] },
      { input: '@bot uptime status', expected: 'uptime', params: [] },
      
      // Utility functions
      { input: '@bot remind me in 10 minutes to check something', expected: 'remind', params: ['time', 'message'] },
      { input: '@bot set a timer for 5 minutes', expected: 'timer', params: ['duration'] },
      { input: '@bot translate this to spanish: hello world', expected: 'translate', params: ['language', 'text'] },
      { input: '@bot weather in new york', expected: 'weather', params: ['location'] },
      { input: '@bot calculate 2 + 2', expected: 'calculate', params: ['expression'] },
      
      // Natural variations
      { input: '@bot what time is it', expected: 'time', params: [] },
      { input: '@bot how long have you been online', expected: 'uptime', params: [] },
      { input: '@bot show me @user profile', expected: 'userinfo', params: ['user'] },
      { input: '@bot whats the weather like', expected: 'weather', params: [] }
    ]
  },

  'ECONOMY_BOT': {
    description: 'Testing economy bot commands',
    commands: [
      // Economy basics
      { input: '@bot balance check', expected: 'balance', params: [] },
      { input: '@bot work for money', expected: 'work', params: [] },
      { input: '@bot daily reward', expected: 'daily', params: [] },
      { input: '@bot pay @user 100 coins', expected: 'pay', params: ['user', 'amount'] },
      { input: '@bot shop items', expected: 'shop', params: [] },
      { input: '@bot buy item 1', expected: 'buy', params: ['item'] },
      { input: '@bot sell item sword', expected: 'sell', params: ['item'] },
      { input: '@bot inventory check', expected: 'inventory', params: [] },
      
      // Gambling/games
      { input: '@bot flip coin heads', expected: 'coinflip', params: ['choice'] },
      { input: '@bot dice roll', expected: 'dice', params: [] },
      { input: '@bot bet 50 on heads', expected: 'bet', params: ['amount', 'choice'] },
      { input: '@bot slots spin', expected: 'slots', params: [] },
      
      // Natural variations
      { input: '@bot how much money do I have', expected: 'balance', params: [] },
      { input: '@bot give @user some coins', expected: 'pay', params: ['user'] },
      { input: '@bot gamble 20 coins', expected: 'bet', params: ['amount'] },
      { input: '@bot what can I buy', expected: 'shop', params: [] }
    ]
  },

  'FUN_BOT': {
    description: 'Testing fun/entertainment bot commands',
    commands: [
      // Fun commands
      { input: '@bot joke tell me one', expected: 'joke', params: [] },
      { input: '@bot meme random', expected: 'meme', params: [] },
      { input: '@bot 8ball will it rain tomorrow', expected: '8ball', params: ['question'] },
      { input: '@bot rate @user hotness', expected: 'rate', params: ['user'] },
      { input: '@bot choose pizza or burger', expected: 'choose', params: ['options'] },
      { input: '@bot fact random', expected: 'fact', params: [] },
      { input: '@bot quote inspirational', expected: 'quote', params: [] },
      
      // Interactive
      { input: '@bot hug @user', expected: 'hug', params: ['user'] },
      { input: '@bot pat @user head', expected: 'pat', params: ['user'] },
      { input: '@bot slap @user with fish', expected: 'slap', params: ['user'] },
      { input: '@bot dance party', expected: 'dance', params: [] },
      
      // Natural variations
      { input: '@bot tell me something funny', expected: 'joke', params: [] },
      { input: '@bot should I do homework', expected: '8ball', params: ['question'] },
      { input: '@bot pick between option1 and option2', expected: 'choose', params: ['options'] },
      { input: '@bot give me a random fact', expected: 'fact', params: [] }
    ]
  },

  'ROLE_MANAGEMENT': {
    description: 'Testing role management commands',
    commands: [
      // Role operations
      { input: '@bot give @user admin role', expected: 'addrole', params: ['user', 'role'] },
      { input: '@bot remove @user member role', expected: 'removerole', params: ['user', 'role'] },
      { input: '@bot create role moderator', expected: 'createrole', params: ['name'] },
      { input: '@bot delete role temp', expected: 'deleterole', params: ['role'] },
      { input: '@bot list all roles', expected: 'roles', params: [] },
      { input: '@bot role info admin', expected: 'roleinfo', params: ['role'] },
      
      // Natural variations
      { input: '@bot make @user a moderator', expected: 'addrole', params: ['user', 'role'] },
      { input: '@bot take away @user admin permissions', expected: 'removerole', params: ['user', 'role'] },
      { input: '@bot show me all server roles', expected: 'roles', params: [] },
      { input: '@bot what roles does @user have', expected: 'userroles', params: ['user'] }
    ]
  }
};

// Test execution functions
async function testBotType(botType, tests) {
  console.log(`\n🤖 Testing ${botType} (${tests.description})`);
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  let total = tests.commands.length;
  
  for (let i = 0; i < tests.commands.length; i++) {
    const test = tests.commands[i];
    console.log(`\n[${i + 1}/${total}] Testing: "${test.input}"`);
    
    try {
      const result = await callDiscordAPI(test.input);
      const success = validateResult(result, test.expected, test.params);
      
      if (success) {
        console.log(`✅ PASS: Detected "${test.expected}" command`);
        passed++;
      } else {
        console.log(`❌ FAIL: Expected "${test.expected}", got different result`);
        console.log(`   Response: ${result.response || 'No response'}`);
        failed++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 ${botType} Results: ${passed}/${total} passed (${((passed/total)*100).toFixed(1)}%)`);
  return { passed, failed, total };
}

async function callDiscordAPI(messageContent) {
  const messageData = {
    message: {
      content: messageContent,
      author: {
        id: TEST_USER_ID,
        username: 'test_user',
        bot: false
      },
      channel_id: '1234567890',
      guild_id: '0987654321',
      mentions: extractMentions(messageContent)
    },
    botToken: 'test_token',
    botClientId: TEST_BOT_ID
  };

  const response = await fetch(`${COMMANDLESS_API_URL}/api/discord?action=process-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messageData)
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return await response.json();
}

function extractMentions(content) {
  const mentions = [];
  const mentionRegex = /@user/g;
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push({
      id: TEST_USER_ID,
      username: 'test_user'
    });
  }
  
  return mentions;
}

function validateResult(result, expectedCommand, expectedParams) {
  if (!result.processed) {
    return false;
  }
  
  // Check if it's a command execution
  if (result.response && result.response.startsWith('Command executed:')) {
    const commandMatch = result.response.match(/Command executed:\s*\/([a-zA-Z0-9_-]+)/);
    if (commandMatch) {
      const detectedCommand = commandMatch[1].toLowerCase();
      return detectedCommand === expectedCommand.toLowerCase() || 
             isCommandSynonym(detectedCommand, expectedCommand);
    }
  }
  
  // Check conversational responses that might indicate understanding
  if (result.response) {
    const response = result.response.toLowerCase();
    if (response.includes(expectedCommand.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

function isCommandSynonym(detected, expected) {
  const synonyms = {
    'timeout': 'mute',
    'silence': 'mute',
    'nuke': 'purge',
    'clear': 'purge',
    'yeet': 'ban',
    'remove': 'ban',
    'boot': 'kick',
    'eject': 'kick'
  };
  
  return synonyms[detected] === expected || synonyms[expected] === detected;
}

// Conversation flow tests
async function testConversationFlow() {
  console.log('\n💬 Testing Conversation Flow & Reply Detection');
  console.log('='.repeat(60));
  
  const conversationTests = [
    { input: '@bot hello', expected: 'conversational' },
    { input: '@bot how are you', expected: 'conversational' },
    { input: '@bot what can you do', expected: 'help' },
    { input: '@bot help me', expected: 'help' },
    { input: '@bot thanks', expected: 'conversational' },
    { input: '@bot that was awesome', expected: 'conversational' }
  ];
  
  let passed = 0;
  
  for (const test of conversationTests) {
    console.log(`\nTesting: "${test.input}"`);
    
    try {
      const result = await callDiscordAPI(test.input);
      
      if (result.processed && result.response) {
        const isConversational = !result.response.startsWith('Command executed:');
        const isHelp = result.response.includes('command') || result.response.includes('help');
        
        let success = false;
        if (test.expected === 'conversational' && isConversational && !isHelp) {
          success = true;
        } else if (test.expected === 'help' && isHelp) {
          success = true;
        }
        
        if (success) {
          console.log(`✅ PASS: Proper ${test.expected} response`);
          passed++;
        } else {
          console.log(`❌ FAIL: Expected ${test.expected} response`);
          console.log(`   Response: ${result.response}`);
        }
      } else {
        console.log(`❌ FAIL: No response generated`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Conversation Flow: ${passed}/${conversationTests.length} passed`);
  return { passed, failed: conversationTests.length - passed, total: conversationTests.length };
}

// Edge case tests
async function testEdgeCases() {
  console.log('\n⚠️ Testing Edge Cases & Error Handling');
  console.log('='.repeat(60));
  
  const edgeTests = [
    { input: '@bot', expected: 'should_respond' },
    { input: '@bot warnban @user', expected: 'should_fail' },
    { input: '@bot really long message with lots of words that might confuse the AI but should still detect ban @user for spam', expected: 'should_work' },
    { input: '@bot @user @user ban both', expected: 'should_work' },
    { input: '@bot 123456789', expected: 'should_respond' }
  ];
  
  let passed = 0;
  
  for (const test of edgeTests) {
    console.log(`\nTesting edge case: "${test.input}"`);
    
    try {
      const result = await callDiscordAPI(test.input);
      
      let success = false;
      if (test.expected === 'should_respond' && result.processed && result.response) {
        success = true;
      } else if (test.expected === 'should_fail' && (!result.processed || result.response.includes('sorry') || result.response.includes('error'))) {
        success = true;
      } else if (test.expected === 'should_work' && result.processed && result.response) {
        success = true;
      }
      
      if (success) {
        console.log(`✅ PASS: Handled edge case correctly`);
        passed++;
      } else {
        console.log(`❌ FAIL: Unexpected behavior`);
        console.log(`   Expected: ${test.expected}, Got: ${result.processed ? 'processed' : 'not processed'}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Edge Cases: ${passed}/${edgeTests.length} passed`);
  return { passed, failed: edgeTests.length - passed, total: edgeTests.length };
}

// Main execution
async function runComprehensiveTests() {
  console.log('🚀 Comprehensive Bot Type Testing Suite');
  console.log('=========================================');
  console.log(`📡 Testing against: ${COMMANDLESS_API_URL}`);
  console.log(`🤖 Bot ID: ${TEST_BOT_ID}`);
  console.log(`👤 User ID: ${TEST_USER_ID}\n`);
  
  const allResults = [];
  
  // Test each bot type
  for (const [botType, tests] of Object.entries(botTypeTests)) {
    const result = await testBotType(botType, tests);
    allResults.push({ type: botType, ...result });
  }
  
  // Test conversation flow
  const conversationResult = await testConversationFlow();
  allResults.push({ type: 'CONVERSATION_FLOW', ...conversationResult });
  
  // Test edge cases
  const edgeResult = await testEdgeCases();
  allResults.push({ type: 'EDGE_CASES', ...edgeResult });
  
  // Final summary
  console.log('\n\n🎯 FINAL TEST SUMMARY');
  console.log('='.repeat(60));
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;
  
  allResults.forEach(result => {
    const percentage = ((result.passed / result.total) * 100).toFixed(1);
    console.log(`${result.type.padEnd(20)} | ${result.passed}/${result.total} (${percentage}%)`);
    
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalTests += result.total;
  });
  
  const overallPercentage = ((totalPassed / totalTests) * 100).toFixed(1);
  
  console.log('='.repeat(60));
  console.log(`🏆 OVERALL RESULTS: ${totalPassed}/${totalTests} tests passed (${overallPercentage}%)`);
  
  if (overallPercentage >= 90) {
    console.log('🌟 EXCELLENT! System is performing very well across all bot types.');
  } else if (overallPercentage >= 75) {
    console.log('✅ GOOD! System is working well with some areas for improvement.');
  } else if (overallPercentage >= 60) {
    console.log('⚠️ FAIR! System has basic functionality but needs significant improvements.');
  } else {
    console.log('❌ POOR! System needs major fixes before production use.');
  }
  
  console.log('\n🔍 Test completed! Check results above for detailed analysis.');
}

// Run the tests
runComprehensiveTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});

export { runComprehensiveTests, testBotType, callDiscordAPI }; 