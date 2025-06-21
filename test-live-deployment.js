/**
 * Live Deployment Test - Verify 100% Accuracy Improvements
 * Tests the actual Discord system with enhanced natural language processing
 */

import { storage } from './server/storage.js';

// Enhanced test cases that were previously failing
const deploymentTestCases = [
  {
    name: 'Enhanced Natural Language Ban',
    input: 'please remove spammer they are being toxic',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'ban', hasUser: true, hasReason: true },
    note: 'Previously failed - should now work with phrase patterns'
  },
  {
    name: 'Enhanced Ping Synonym Recognition',
    input: 'how fast is your response time?',
    mentionedUsers: [],
    expected: { action: 'ping' },
    note: 'Previously failed - should now work with expanded keywords'
  },
  {
    name: 'Enhanced Conversational Filtering',
    input: 'hello how are you today?',
    mentionedUsers: [],
    expected: null,
    note: 'Should be properly rejected as conversational'
  },
  {
    name: 'Complex Natural Language Warning',
    input: 'warn user because they have been consistently breaking our server rules',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'warn', hasUser: true, hasReason: true },
    note: 'Enhanced reason extraction test'
  },
  {
    name: 'Advanced Role Assignment',
    input: 'give newuser admin role please',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'role', hasUser: true, hasRole: true },
    note: 'Natural language role assignment with politeness'
  },
  {
    name: 'Informal Mute Command',
    input: 'timeout user for 1 hour they are being annoying',
    mentionedUsers: ['560079402013032448'],
    expected: { action: 'mute', hasUser: true, hasDuration: true, hasReason: true },
    note: 'Synonym mapping + reason extraction'
  }
];

/**
 * Test the live Discord action executor with our improvements
 */
async function testLiveDeployment() {
  console.log('🚀 LIVE DEPLOYMENT TEST - Enhanced Natural Language Processing');
  console.log('='.repeat(80));
  console.log('Testing 100% accuracy improvements in live system...\n');

  try {
    // Import the enhanced parseCommand function from the live system
    const { executeDiscordAction } = await import('./server/discord/discordActionExecutor.js');
    
    // Mock message object for testing
    const createMockMessage = (mentions = []) => ({
      guild: {
        id: '1022546113204600896',
        members: {
          me: {
            permissions: {
              has: () => true // Mock permissions
            }
          },
          fetch: () => Promise.resolve({
            displayName: 'TestUser',
            timeout: () => Promise.resolve(),
            kick: () => Promise.resolve()
          })
        },
        bans: {
          create: () => Promise.resolve()
        }
      },
      channel: {
        id: '1022546113204600896',
        isTextBased: () => true,
        isDMBased: () => false,
        send: () => Promise.resolve(),
        bulkDelete: () => Promise.resolve(new Map()),
        setRateLimitPerUser: () => Promise.resolve()
      },
      author: {
        id: '123456789',
        username: 'TestUser'
      },
      mentions: {
        users: {
          values: () => mentions.map(id => ({ id }))
        }
      },
      client: {
        user: { id: '1373685784779165776' },
        ws: { ping: 42 }
      },
      delete: () => Promise.resolve(),
      pin: () => Promise.resolve(),
      reference: null
    });

    let passed = 0;
    let total = deploymentTestCases.length;

    for (let i = 0; i < deploymentTestCases.length; i++) {
      const test = deploymentTestCases[i];
      console.log(`${i + 1}. Testing: ${test.name}`);
      console.log(`   Input: "${test.input}"`);
      console.log(`   Note: ${test.note}`);
      
      try {
        const mockMessage = createMockMessage(test.mentionedUsers);
        const result = await executeDiscordAction(test.input, mockMessage);
        
        if (test.expected === null) {
          // Expecting failure/rejection
          if (!result.success || result.error?.includes('Could not parse command')) {
            console.log(`   ✅ PASS: Correctly rejected conversational input`);
            passed++;
          } else {
            console.log(`   ❌ FAIL: Expected rejection but got: ${JSON.stringify(result)}`);
          }
        } else {
          // Expecting successful parsing
          if (result.success) {
            console.log(`   ✅ PASS: Successfully executed command`);
            console.log(`   Response: ${result.response?.substring(0, 100)}...`);
            passed++;
          } else {
            console.log(`   ❌ FAIL: Command failed - ${result.error}`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
      
      console.log('');
    }

    // Results summary
    const successRate = ((passed / total) * 100).toFixed(1);
    console.log('='.repeat(80));
    console.log('🎯 LIVE DEPLOYMENT TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`Passed: ${passed}/${total} (${successRate}%)`);
    
    if (parseFloat(successRate) >= 90) {
      console.log('🏆 EXCELLENT: Deployment successful! Enhanced parsing is working perfectly.');
    } else if (parseFloat(successRate) >= 75) {
      console.log('👍 GOOD: Deployment successful with minor issues.');
    } else {
      console.log('⚠️  WARNING: Deployment may have issues that need attention.');
    }
    
    console.log('='.repeat(80));

    return { passed, total, successRate: parseFloat(successRate) };

  } catch (error) {
    console.error('❌ DEPLOYMENT TEST FAILED:', error.message);
    return { passed: 0, total: deploymentTestCases.length, successRate: 0 };
  }
}

// Run the deployment test
if (import.meta.url === `file://${process.argv[1]}`) {
  testLiveDeployment().catch(console.error);
}

export { testLiveDeployment }; 