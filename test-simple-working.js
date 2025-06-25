#!/usr/bin/env node

/**
 * Simple Working Test Suite - Tests actual commands in your system
 */

import fetch from 'node-fetch';

const COMMANDLESS_API_URL = 'https://commandless-app-production.up.railway.app';
const TEST_BOT_ID = '1373685784779165776';
const TEST_USER_ID = '560079402013032448';

async function testCommand(description, messageContent) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`   Input: "${messageContent}"`);
  
  try {
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
        mentions: messageContent.includes('@user') ? [{
          id: TEST_USER_ID,
          username: 'test_user'
        }] : []
      },
      botToken: 'test_token',
      botClientId: TEST_BOT_ID
    };

    const response = await fetch(`${COMMANDLESS_API_URL}/api/discord?action=process-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    const result = await response.json();
    
    if (result.processed && result.response) {
      console.log(`✅ SUCCESS: ${result.response}`);
      return true;
    } else {
      console.log(`❌ FAILED: ${result.reason || 'No response'}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runQuickTests() {
  console.log('🚀 Quick Test Suite - Testing Real Commands');
  console.log('===========================================\n');
  
  let passed = 0;
  let total = 0;
  
  // Test basic conversation
  total++; if (await testCommand('Basic greeting', '@bot hello')) passed++;
  total++; if (await testCommand('How are you', '@bot how are you')) passed++;
  total++; if (await testCommand('Help request', '@bot what can you do')) passed++;
  total++; if (await testCommand('Help command', '@bot help')) passed++;
  
  // Test basic commands that should exist
  total++; if (await testCommand('Pin command', '@bot pin this message')) passed++;
  total++; if (await testCommand('Ban with user mention', '@bot ban @user for spam')) passed++;
  total++; if (await testCommand('Natural ban', '@bot remove @user they are toxic')) passed++;
  total++; if (await testCommand('Kick command', '@bot kick @user for trolling')) passed++;
  total++; if (await testCommand('Warn command', '@bot warn @user for being rude')) passed++;
  total++; if (await testCommand('Purge command', '@bot purge 10 messages')) passed++;
  
  // Test natural language variations
  total++; if (await testCommand('Natural pin', '@bot stick this message')) passed++;
  total++; if (await testCommand('Casual ban', '@bot yeet @user outta here')) passed++;
  total++; if (await testCommand('Natural delete', '@bot delete 5 messages')) passed++;
  
  // Test reply functionality (simulate)
  total++; if (await testCommand('Simulated reply context', '@bot thanks for the help')) passed++;
  
  console.log(`\n📊 RESULTS: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);
  
  if (passed/total >= 0.8) {
    console.log('🌟 EXCELLENT! System is working very well.');
  } else if (passed/total >= 0.6) {
    console.log('✅ GOOD! System is functional with room for improvement.');
  } else if (passed/total >= 0.4) {
    console.log('⚠️ FAIR! Basic functionality working but needs improvements.');
  } else {
    console.log('❌ POOR! System needs significant fixes.');
  }
}

runQuickTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
}); 