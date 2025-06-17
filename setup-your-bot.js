const fetch = require('node-fetch');

const API_URL = 'https://commandlessapp-nft6hub5t-abdarrahmans-projects.vercel.app';

// You'll need to replace this with your real Discord bot token
const YOUR_DISCORD_BOT_TOKEN = 'YOUR_REAL_DISCORD_BOT_TOKEN_HERE';
const YOUR_USER_ID = 'user_2qx3YZ1AbCdEfGhI'; // Your Clerk user ID

async function setupYourBot() {
  console.log('🤖 Setting up your Discord bot in Commandless...\n');
  
  if (YOUR_DISCORD_BOT_TOKEN === 'YOUR_REAL_DISCORD_BOT_TOKEN_HERE') {
    console.log('❌ Please edit this script and add your real Discord bot token');
    console.log('💡 Get your token from: https://discord.com/developers/applications');
    console.log('   1. Select your application');
    console.log('   2. Go to "Bot" section');
    console.log('   3. Copy the token');
    console.log('   4. Replace YOUR_REAL_DISCORD_BOT_TOKEN_HERE in this script');
    return;
  }
  
  try {
    // Step 1: Create the bot in Commandless
    console.log('1️⃣ Creating bot in Commandless system...');
    const createResponse = await fetch(`${API_URL}/api/bots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YOUR_USER_ID}`
      },
      body: JSON.stringify({
        botName: 'test_bot2007',
        platformType: 'discord',
        token: YOUR_DISCORD_BOT_TOKEN,
        personalityContext: 'You are test_bot2007, a helpful Discord bot that responds to greetings and helps with server moderation. Be friendly and conversational.'
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      console.log('❌ Failed to create bot:', error.error);
      if (error.error === 'Invalid Discord bot token') {
        console.log('💡 Make sure your Discord bot token is correct and valid');
      }
      return;
    }
    
    const bot = await createResponse.json();
    console.log('✅ Bot created successfully!');
    console.log('   Bot ID:', bot.id);
    console.log('   Bot Name:', bot.botName);
    
    // Step 2: Connect the bot (this will generate client code)
    console.log('\n2️⃣ Connecting bot and generating client code...');
    const connectResponse = await fetch(`${API_URL}/api/bots`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YOUR_USER_ID}`
      },
      body: JSON.stringify({
        id: bot.id,
        action: 'connect'
      })
    });
    
    if (!connectResponse.ok) {
      const error = await connectResponse.json();
      console.log('❌ Failed to connect bot:', error.error);
      return;
    }
    
    const connectedBot = await connectResponse.json();
    console.log('✅ Bot connected successfully!');
    
    if (connectedBot.clientCode) {
      // Step 3: Save the client code to a file
      console.log('\n3️⃣ Saving Discord client code...');
      const fs = require('fs');
      fs.writeFileSync('test_bot2007_client.js', connectedBot.clientCode);
      console.log('✅ Client code saved to: test_bot2007_client.js');
      
      // Step 4: Show instructions
      console.log('\n🎉 Setup complete! Now run your bot:');
      console.log('');
      console.log('📋 Instructions:');
      connectedBot.instructions.forEach((instruction, index) => {
        console.log(`   ${index + 1}. ${instruction}`);
      });
      
      console.log('\n🚀 Quick start:');
      console.log('   npm install discord.js node-fetch');
      console.log('   node test_bot2007_client.js');
      console.log('');
      console.log('🧪 Test in Discord:');
      console.log('   @test_bot2007 hello');
      console.log('   @test_bot2007 wassup?');
      console.log('   @test_bot2007 ban @user for spam');
      
    } else {
      console.log('❌ No client code generated - something went wrong');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

setupYourBot(); 