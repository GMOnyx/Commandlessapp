const fetch = require('node-fetch');

const RAILWAY_URL = 'https://commandless-app-production.up.railway.app';
const YOUR_USER_ID = 'user_2qx3YZ1AbCdEfGhI'; // Your Clerk user ID

async function testCommandSync() {
  console.log('🔄 Testing Command Discovery & Sync Functionality\n');
  
  try {
    // Step 1: Get your existing bots
    console.log('1️⃣ Fetching your bots...');
    const botsResponse = await fetch(`${RAILWAY_URL}/api/bots`, {
      headers: {
        'Authorization': `Bearer ${YOUR_USER_ID}`
      }
    });
    
    if (!botsResponse.ok) {
      console.log('❌ Failed to fetch bots');
      return;
    }
    
    const bots = await botsResponse.json();
    console.log(`✅ Found ${bots.length} bots`);
    
    if (bots.length === 0) {
      console.log('📝 No bots found. Create a bot first through the frontend.');
      return;
    }
    
    // Step 2: Test command sync on the first bot
    const testBot = bots[0];
    console.log(`\n2️⃣ Testing command sync on "${testBot.botName}"...`);
    
    const syncResponse = await fetch(`${RAILWAY_URL}/api/bots`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YOUR_USER_ID}`
      },
      body: JSON.stringify({
        id: testBot.id,
        action: 'sync-commands'
      })
    });
    
    console.log('   Sync response status:', syncResponse.status);
    
    if (syncResponse.ok) {
      const syncResult = await syncResponse.json();
      console.log('🎉 Command sync successful!');
      console.log('   Commands found:', syncResult.commandsFound);
      console.log('   Commands created:', syncResult.commandsCreated);
      console.log('   Commands skipped:', syncResult.commandsSkipped);
      
      if (syncResult.discoveredCommands && syncResult.discoveredCommands.length > 0) {
        console.log('\n📋 Discovered commands:');
        syncResult.discoveredCommands.forEach(cmd => {
          console.log(`   - ${cmd.name}: ${cmd.description}`);
        });
      }
      
      // Step 3: Verify command mappings were created
      console.log('\n3️⃣ Verifying command mappings...');
      const mappingsResponse = await fetch(`${RAILWAY_URL}/api/mappings`, {
        headers: {
          'Authorization': `Bearer ${YOUR_USER_ID}`
        }
      });
      
      if (mappingsResponse.ok) {
        const mappings = await mappingsResponse.json();
        console.log(`✅ Found ${mappings.length} command mappings`);
        
        if (mappings.length > 0) {
          console.log('\n📝 Your command mappings:');
          mappings.forEach(mapping => {
            console.log(`   - ${mapping.commandName}: ${mapping.description}`);
            console.log(`     Action: ${mapping.actionType}, Used: ${mapping.usageCount} times`);
          });
        }
        
        // Step 4: Test creating a new command mapping
        console.log('\n4️⃣ Testing manual command mapping creation...');
        const createMappingResponse = await fetch(`${RAILWAY_URL}/api/mappings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${YOUR_USER_ID}`
          },
          body: JSON.stringify({
            botId: testBot.id,
            commandName: 'test-command',
            description: 'A test command created via API',
            actionType: 'custom',
            responseTemplate: 'This is a test response!'
          })
        });
        
        if (createMappingResponse.ok) {
          const newMapping = await createMappingResponse.json();
          console.log('✅ Manual command mapping created successfully!');
          console.log(`   Command: ${newMapping.commandName}`);
          console.log(`   Description: ${newMapping.description}`);
        } else {
          const error = await createMappingResponse.json();
          console.log('⚠️ Manual mapping creation failed:', error.error);
        }
        
      } else {
        console.log('❌ Failed to fetch command mappings');
      }
      
    } else {
      const syncError = await syncResponse.json();
      console.log('❌ Command sync failed:', syncError.error);
      
      if (syncError.details) {
        console.log('   Details:', syncError.details);
      }
    }
    
    console.log('\n✅ Command sync test completed!');
    console.log('🎯 Next steps:');
    console.log('   1. Go to your frontend and click "Sync Commands" on any bot');
    console.log('   2. Check the "Command Mappings" page to see discovered commands');
    console.log('   3. The sync should now work exactly like your local environment!');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

console.log('🚀 Starting Command Sync Test...\n');
testCommandSync(); 