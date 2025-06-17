const fetch = require('node-fetch');

const RAILWAY_URL = 'https://commandless-app-production.up.railway.app';
const YOUR_USER_ID = 'user_2qx3YZ1AbCdEfGhI';

async function testRailwayBotCreation() {
  console.log('🧪 Testing Bot Creation via Railway Backend\n');
  
  try {
    // Test 1: Create a bot with a unique name
    console.log('1️⃣ Testing bot creation with unique name...');
    const uniqueName = 'Test Bot ' + Date.now();
    
    const createResponse = await fetch(`${RAILWAY_URL}/api/bots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YOUR_USER_ID}`
      },
      body: JSON.stringify({
        botName: uniqueName,
        platformType: 'discord',
        token: 'test_token_' + Date.now(),
        personalityContext: 'A test bot for debugging Railway backend'
      })
    });
    
    console.log('   Response status:', createResponse.status);
    
    if (createResponse.ok) {
      const newBot = await createResponse.json();
      console.log('✅ Bot creation successful!');
      console.log('   Bot ID:', newBot.id);
      console.log('   Bot Name:', newBot.botName);
      console.log('   Platform:', newBot.platformType);
    } else {
      const errorResponse = await createResponse.text();
      console.log('❌ Bot creation failed');
      console.log('   Error response:', errorResponse);
      
      try {
        const errorData = JSON.parse(errorResponse);
        console.log('   Parsed error:', errorData);
      } catch (e) {
        console.log('   Raw error text:', errorResponse);
      }
    }
    
    // Test 2: List existing bots
    console.log('\n2️⃣ Checking existing bots via Railway...');
    const listResponse = await fetch(`${RAILWAY_URL}/api/bots`, {
      headers: {
        'Authorization': `Bearer ${YOUR_USER_ID}`
      }
    });
    
    if (listResponse.ok) {
      const bots = await listResponse.json();
      console.log(`✅ Found ${bots.length} bots via Railway backend`);
      bots.forEach((bot, index) => {
        console.log(`   ${index + 1}. ${bot.botName} (ID: ${bot.id})`);
      });
    } else {
      console.log('❌ Failed to list bots via Railway');
    }
    
    // Test 3: Try creating another bot to see if it's really a constraint issue
    console.log('\n3️⃣ Testing second bot creation...');
    const secondUniqueName = 'Second Test Bot ' + Date.now();
    
    const createResponse2 = await fetch(`${RAILWAY_URL}/api/bots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YOUR_USER_ID}`
      },
      body: JSON.stringify({
        botName: secondUniqueName,
        platformType: 'discord',
        token: 'second_test_token_' + Date.now(),
        personalityContext: 'A second test bot for debugging'
      })
    });
    
    console.log('   Second bot response status:', createResponse2.status);
    
    if (createResponse2.ok) {
      const secondBot = await createResponse2.json();
      console.log('✅ Second bot creation successful!');
      console.log('   Bot ID:', secondBot.id);
      console.log('   Bot Name:', secondBot.botName);
    } else {
      const errorResponse2 = await createResponse2.text();
      console.log('❌ Second bot creation failed');
      console.log('   Error response:', errorResponse2);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testRailwayBotCreation(); 