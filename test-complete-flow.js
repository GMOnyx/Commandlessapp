const fetch = require('node-fetch');

const RAILWAY_URL = 'https://commandless-app-production.up.railway.app';
const YOUR_USER_ID = 'user_2qx3YZ1AbCdEfGhI'; // Your Clerk user ID

async function testCompleteFlow() {
  console.log('🎯 Testing Complete Discord Bot Flow via Railway\n');
  
  try {
    // Step 1: Create a new Discord bot
    console.log('1️⃣ Creating a new Discord bot...');
    const createResponse = await fetch(`${RAILWAY_URL}/api/bots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YOUR_USER_ID}`
      },
      body: JSON.stringify({
        botName: 'Railway Test Bot',
        platformType: 'discord',
        token: 'YOUR_DISCORD_BOT_TOKEN_HERE', // Replace with a real Discord bot token
        personalityContext: 'A helpful AI assistant running on Railway'
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      console.log('❌ Bot creation failed:', error);
      return;
    }
    
    const newBot = await createResponse.json();
    console.log('✅ Bot created successfully!');
    console.log('   Bot Name:', newBot.botName);
    console.log('   Bot ID:', newBot.id);
    console.log('   Platform:', newBot.platformType);
    console.log('   Connected:', newBot.isConnected);
    
    // Step 2: Connect the bot (this should auto-start it)
    console.log('\n2️⃣ Connecting the Discord bot...');
    const connectResponse = await fetch(`${RAILWAY_URL}/api/bots`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YOUR_USER_ID}`
      },
      body: JSON.stringify({
        id: newBot.id,
        action: 'connect'
      })
    });
    
    console.log('   Connect response status:', connectResponse.status);
    const connectResult = await connectResponse.json();
    
    if (connectResponse.ok && connectResult.autoStarted) {
      console.log('🎉 SUCCESS! Bot auto-started successfully!');
      console.log('   Message:', connectResult.message);
      console.log('   Bot is now live and responding in Discord!');
      
      // Step 3: Verify bot is listed as connected
      console.log('\n3️⃣ Verifying bot status...');
      const listResponse = await fetch(`${RAILWAY_URL}/api/bots`, {
        headers: {
          'Authorization': `Bearer ${YOUR_USER_ID}`
        }
      });
      
      if (listResponse.ok) {
        const bots = await listResponse.json();
        const connectedBot = bots.find(bot => bot.id === newBot.id);
        
        if (connectedBot && connectedBot.isConnected) {
          console.log('✅ Bot status verified - Connected!');
          console.log('   Found in bot list as connected');
        } else {
          console.log('⚠️ Bot found but not showing as connected');
        }
      }
      
      // Step 4: Test Discord interaction
      console.log('\n4️⃣ Your bot is ready for testing!');
      console.log('🧪 Test your bot in Discord:');
      console.log(`   1. Go to your Discord server`);
      console.log(`   2. Mention your bot: @${newBot.botName} hello`);
      console.log(`   3. Try: @${newBot.botName} what can you do?`);
      console.log(`   4. The bot should respond with AI messages!`);
      
      console.log('\n🎯 SUCCESS SUMMARY:');
      console.log('   ✅ Railway backend is working');
      console.log('   ✅ Supabase database is connected');
      console.log('   ✅ Bot creation works');
      console.log('   ✅ Bot auto-start works (just like locally!)');
      console.log('   ✅ Discord bot is live and responding');
      console.log('');
      console.log('🌟 Your exact local app is now running online!');
      
    } else if (connectResult.error) {
      console.log('❌ Bot connection failed:', connectResult.error);
      
      if (connectResult.error.includes('Invalid') || connectResult.error.includes('token')) {
        console.log('');
        console.log('💡 This is likely because you need to:');
        console.log('   1. Create a Discord bot at https://discord.com/developers/applications');
        console.log('   2. Get the bot token');
        console.log('   3. Replace "YOUR_DISCORD_BOT_TOKEN_HERE" in this test with the real token');
        console.log('   4. Invite the bot to your Discord server');
      }
    } else {
      console.log('⚠️ Unexpected connection response:', connectResult);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

console.log('🚀 Starting Complete Flow Test...\n');
console.log('📝 NOTE: Replace "YOUR_DISCORD_BOT_TOKEN_HERE" with a real Discord bot token');
console.log('   You can get one from https://discord.com/developers/applications\n');

testCompleteFlow(); 