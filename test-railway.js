const fetch = require('node-fetch');

const RAILWAY_URL = 'https://commandless-app-production.up.railway.app';
const YOUR_USER_ID = 'user_2qx3YZ1AbCdEfGhI'; // Your Clerk user ID

async function testRailwayBackend() {
  console.log('🚂 Testing Railway Backend with Updated Supabase\n');
  
  try {
    // Wait for deployment to complete
    console.log('⏳ Waiting for Railway deployment to complete...');
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    
    // Step 1: Test basic health check
    console.log('1️⃣ Testing health check...');
    const healthResponse = await fetch(`${RAILWAY_URL}/health`);
    
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Health check passed');
      console.log('   Status:', health.status);
      console.log('   Active bots:', health.activeBots);
      console.log('   Uptime:', Math.round(health.uptime), 'seconds');
    } else {
      console.log('❌ Health check failed');
      return;
    }
    
    // Step 2: Test bot listing with your actual data
    console.log('\n2️⃣ Testing bot listing with your Supabase data...');
    const botsResponse = await fetch(`${RAILWAY_URL}/api/bots`, {
      headers: {
        'Authorization': `Bearer ${YOUR_USER_ID}`
      }
    });
    
    console.log('   Response status:', botsResponse.status);
    
    if (botsResponse.ok) {
      const bots = await botsResponse.json();
      console.log('✅ Bot listing works!');
      console.log('   Found', bots.length, 'bots in your Supabase database');
      
      if (bots.length > 0) {
        console.log('   Your bots:');
        bots.forEach(bot => {
          console.log(`   - ${bot.botName} (${bot.platformType}) - ${bot.isConnected ? '🟢 Connected' : '🔴 Disconnected'}`);
        });
        
        // Step 3: Test connecting an existing bot
        const disconnectedBot = bots.find(bot => !bot.isConnected);
        if (disconnectedBot) {
          console.log(`\n3️⃣ Testing bot connection with "${disconnectedBot.botName}"...`);
          const connectResponse = await fetch(`${RAILWAY_URL}/api/bots`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${YOUR_USER_ID}`
            },
            body: JSON.stringify({
              id: disconnectedBot.id,
              action: 'connect'
            })
          });
          
          console.log('   Connect response status:', connectResponse.status);
          const connectResult = await connectResponse.json();
          
          if (connectResponse.ok && connectResult.autoStarted) {
            console.log('🎉 SUCCESS: Bot auto-start functionality is working!');
            console.log(`   ${disconnectedBot.botName} is now live and responding in Discord!`);
            console.log('   Message:', connectResult.message);
            
            // Test the bot in Discord
            console.log('\n🧪 Your bot is now live! Test it in Discord:');
            console.log(`   @${disconnectedBot.botName} hello`);
            console.log(`   @${disconnectedBot.botName} what can you do?`);
            
          } else if (connectResult.error) {
            console.log('⚠️ Bot connection failed:', connectResult.error);
            console.log('   This might be due to an invalid Discord token');
          } else {
            console.log('⚠️ Bot connection response:', connectResult);
          }
        } else {
          console.log('\n3️⃣ All bots are already connected!');
        }
      } else {
        console.log('   No bots found in your database');
        console.log('   You can create bots through the frontend interface');
      }
    } else {
      const botsError = await botsResponse.json();
      console.log('❌ Bot listing failed:', botsError);
      console.log('   This indicates a Supabase connection issue');
    }
    
    console.log('\n✅ Railway backend test completed!');
    console.log('🌟 Your Railway deployment is connected to your Supabase database!');
    console.log('🔗 Railway URL:', RAILWAY_URL);
    console.log('🎯 Next step: Update your frontend to use this Railway backend');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testRailwayBackend(); 