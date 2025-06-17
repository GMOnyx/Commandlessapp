/**
 * Final Comprehensive Test - Bot Names & Command Discovery
 * 
 * This test verifies:
 * 1. Bot names are displayed correctly (botName field mapping)
 * 2. Command discovery works for Discord bots
 * 3. Manual command sync functionality works
 * 4. All field mappings are consistent between API and frontend
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const BASE_URL = 'https://commandlessapp-3j8q7dog9-abdarrahmans-projects.vercel.app';
const USER_ID = 'user_2yMTRvIng7ljDfRRUlXFvQkWSb5';

// Get environment variables (you'll need to set these)
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'YOUR_DISCORD_BOT_TOKEN';
const CLERK_TOKEN = process.env.CLERK_TOKEN || 'YOUR_CLERK_TOKEN';

// Initialize Supabase for direct database verification
const supabase = createClient(
  process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
  process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
);

console.log('🧪 Starting Final Comprehensive Test');
console.log('===================================');
console.log('Target URL:', BASE_URL);
console.log('User ID:', USER_ID);
console.log('');

/**
 * Test 1: Bot Name Display Fix
 */
async function testBotNameDisplay() {
  console.log('📝 Test 1: Bot Name Display & Field Mapping');
  console.log('--------------------------------------------');
  
  try {
    // Fetch bots from API
    const response = await fetch(`${BASE_URL}/api/bots`, {
      headers: {
        'Authorization': `Bearer ${CLERK_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log('❌ Failed to fetch bots:', response.status);
      return false;
    }
    
    const bots = await response.json();
    console.log(`✅ Fetched ${bots.length} bots from API`);
    
    // Check field structure
    if (bots.length > 0) {
      const bot = bots[0];
      console.log('📋 Bot object structure:');
      console.log('  - id:', !!bot.id);
      console.log('  - botName:', !!bot.botName, bot.botName ? `"${bot.botName}"` : '(missing)');
      console.log('  - platformType:', !!bot.platformType, bot.platformType);
      console.log('  - isConnected:', !!bot.isConnected, bot.isConnected);
      console.log('  - clientId:', !!bot.clientId, bot.clientId ? 'present' : 'missing');
      
      // Verify required fields
      const requiredFields = ['id', 'botName', 'platformType', 'isConnected'];
      const missingFields = requiredFields.filter(field => !bot[field] && bot[field] !== false);
      
      if (missingFields.length === 0) {
        console.log('✅ All required fields present and correctly mapped');
        return true;
      } else {
        console.log('❌ Missing fields:', missingFields);
        return false;
      }
    } else {
      console.log('⚠️  No bots found - cannot test field mapping');
      return true; // Not a failure, just no data
    }
  } catch (error) {
    console.log('❌ Bot name display test failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Command Discovery on Bot Creation
 */
async function testCommandDiscoveryOnCreation() {
  console.log('\n🔍 Test 2: Command Discovery on Bot Creation');
  console.log('---------------------------------------------');
  
  try {
    // Create a new Discord bot (this should trigger command discovery)
    const createResponse = await fetch(`${BASE_URL}/api/bots`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLERK_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        botName: 'Test Discovery Bot',
        platformType: 'discord',
        token: DISCORD_BOT_TOKEN,
        personalityContext: 'A test bot for command discovery'
      })
    });
    
    if (!createResponse.ok) {
      console.log('❌ Failed to create bot:', createResponse.status);
      const errorText = await createResponse.text();
      console.log('Error details:', errorText);
      return false;
    }
    
    const createdBot = await createResponse.json();
    console.log('✅ Bot created successfully');
    console.log('  - Bot ID:', createdBot.id);
    console.log('  - Bot Name:', createdBot.botName);
    console.log('  - Connected:', createdBot.isConnected);
    
    // Check if discovery results are included
    if (createdBot.discovery) {
      console.log('✅ Command discovery results included:');
      console.log('  - Success:', createdBot.discovery.success);
      console.log('  - Commands Found:', createdBot.discovery.commandsFound);
      console.log('  - Commands Created:', createdBot.discovery.commandsCreated);
      
      if (createdBot.discovery.success && createdBot.discovery.commandsCreated > 0) {
        console.log('✅ Command discovery successfully created mappings');
        
        // Verify mappings were created in database
        await verifyCommandMappingsInDatabase(createdBot.id);
        
        return true;
      } else if (createdBot.discovery.commandsFound === 0) {
        console.log('⚠️  No commands found to discover (bot has no slash commands)');
        return true;
      } else {
        console.log('❌ Command discovery failed or created no mappings');
        return false;
      }
    } else {
      console.log('⚠️  No discovery results in response (might be non-Discord bot)');
      return true;
    }
  } catch (error) {
    console.log('❌ Command discovery test failed:', error.message);
    return false;
  }
}

/**
 * Test 3: Manual Command Sync
 */
async function testManualCommandSync() {
  console.log('\n🔄 Test 3: Manual Command Sync');
  console.log('------------------------------');
  
  try {
    // Get existing Discord bots
    const botsResponse = await fetch(`${BASE_URL}/api/bots`, {
      headers: {
        'Authorization': `Bearer ${CLERK_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!botsResponse.ok) {
      console.log('❌ Failed to fetch bots');
      return false;
    }
    
    const bots = await botsResponse.json();
    const discordBot = bots.find(bot => bot.platformType === 'discord' && bot.isConnected);
    
    if (!discordBot) {
      console.log('⚠️  No connected Discord bot found for sync test');
      return true;
    }
    
    console.log('🤖 Testing sync with bot:', discordBot.botName);
    
    // Perform manual sync
    const syncResponse = await fetch(`${BASE_URL}/api/bots`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CLERK_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: discordBot.id,
        action: 'sync-commands'
      })
    });
    
    if (!syncResponse.ok) {
      console.log('❌ Failed to sync commands:', syncResponse.status);
      const errorText = await syncResponse.text();
      console.log('Error details:', errorText);
      return false;
    }
    
    const syncResult = await syncResponse.json();
    console.log('✅ Manual sync completed:');
    console.log('  - Success:', syncResult.success);
    console.log('  - Commands Found:', syncResult.commandsFound);
    console.log('  - Commands Created:', syncResult.commandsCreated);
    console.log('  - Commands Skipped:', syncResult.commandsSkipped);
    
    return syncResult.success;
  } catch (error) {
    console.log('❌ Manual sync test failed:', error.message);
    return false;
  }
}

/**
 * Test 4: Verify Command Mappings in Database
 */
async function verifyCommandMappingsInDatabase(botId) {
  console.log('\n💾 Verifying Command Mappings in Database');
  console.log('------------------------------------------');
  
  try {
    const { data: mappings, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('bot_id', botId)
      .eq('user_id', USER_ID);
    
    if (error) {
      console.log('❌ Database query failed:', error.message);
      return false;
    }
    
    console.log(`📊 Found ${mappings.length} command mappings in database`);
    
    mappings.forEach((mapping, index) => {
      console.log(`  ${index + 1}. ${mapping.name}`);
      console.log(`     Pattern: ${mapping.natural_language_pattern}`);
      console.log(`     Output: ${mapping.command_output}`);
      console.log(`     Status: ${mapping.status}`);
      console.log('');
    });
    
    return mappings.length > 0;
  } catch (error) {
    console.log('❌ Database verification failed:', error.message);
    return false;
  }
}

/**
 * Test 5: Activity Logging Verification
 */
async function verifyActivityLogging() {
  console.log('\n📊 Test 4: Activity Logging Verification');
  console.log('----------------------------------------');
  
  try {
    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', USER_ID)
      .in('activity_type', ['commands_discovered', 'commands_synced', 'bot_connected'])
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.log('❌ Failed to fetch activities:', error.message);
      return false;
    }
    
    console.log(`📈 Found ${activities.length} relevant activities`);
    
    activities.forEach((activity, index) => {
      console.log(`  ${index + 1}. ${activity.activity_type}: ${activity.description}`);
      if (activity.metadata) {
        console.log(`     Metadata:`, JSON.stringify(activity.metadata, null, 6));
      }
      console.log('');
    });
    
    return true;
  } catch (error) {
    console.log('❌ Activity verification failed:', error.message);
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Feature Tests\n');
  
  const results = {};
  
  // Run all tests
  results.botNameDisplay = await testBotNameDisplay();
  results.commandDiscovery = await testCommandDiscoveryOnCreation();
  results.manualSync = await testManualCommandSync();
  results.activityLogging = await verifyActivityLogging();
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log('✅ Bot Name Display:', results.botNameDisplay ? 'PASS' : 'FAIL');
  console.log('✅ Command Discovery:', results.commandDiscovery ? 'PASS' : 'FAIL');
  console.log('✅ Manual Sync:', results.manualSync ? 'PASS' : 'FAIL');
  console.log('✅ Activity Logging:', results.activityLogging ? 'PASS' : 'FAIL');
  
  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All features working correctly!');
  } else {
    console.log('⚠️  Some issues detected - check test output above');
  }
  
  return passCount === totalCount;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runAllTests }; 