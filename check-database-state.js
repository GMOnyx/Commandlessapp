const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wimmfsssbdarktvdeqkp.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbW1mc3NzYmRhcmt0dmRlcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NzY5MzEsImV4cCI6MjA2MzE1MjkzMX0.W5dhFdl3IchXUwIIIztZ3aJ4rNcYMOLbCNO4qmvfuWU'
);

async function checkDatabaseState() {
  console.log('🔍 Checking Database State\n');
  
  try {
    // Check existing bots for your user
    console.log('1️⃣ Checking existing bots...');
    const { data: bots, error: botsError } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', 'user_2qx3YZ1AbCdEfGhI');
    
    if (botsError) {
      console.log('❌ Error fetching bots:', botsError.message);
    } else {
      console.log(`✅ Found ${bots?.length || 0} existing bots`);
      if (bots && bots.length > 0) {
        console.log('\n📋 Bot details:');
        bots.forEach((bot, index) => {
          console.log(`   ${index + 1}. ID: ${bot.id}`);
          console.log(`      Name: ${bot.bot_name}`);
          console.log(`      User ID: ${bot.user_id}`);
          console.log(`      Platform: ${bot.platform_type}`);
          console.log(`      Connected: ${bot.is_connected}`);
          console.log('');
        });
      }
    }

    // Check users table
    console.log('2️⃣ Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('id', 'user_2qx3YZ1AbCdEfGhI');
    
    if (usersError) {
      console.log('❌ Error fetching users:', usersError.message);
    } else {
      console.log(`✅ Found ${users?.length || 0} user records`);
      if (users && users.length > 0) {
        console.log('   User details:', users[0]);
      }
    }

    // Try to create a test bot to see the exact error
    console.log('3️⃣ Testing bot creation...');
    const testBot = {
      user_id: 'user_2qx3YZ1AbCdEfGhI',
      platform_type: 'discord',
      bot_name: 'Test Bot ' + Date.now(),
      token: 'test_token_' + Date.now(),
      personality_context: 'Test bot for debugging',
      is_connected: false
    };

    const { data: newBot, error: createError } = await supabase
      .from('bots')
      .insert(testBot)
      .select()
      .single();

    if (createError) {
      console.log('❌ Bot creation failed:', createError.message);
      console.log('   Error details:', createError);
      
      // If it's a unique constraint error, let's check what constraints exist
      if (createError.message.includes('unique constraint')) {
        console.log('\n🔍 This appears to be a unique constraint issue');
        console.log('   The database may have a unique constraint on user_id');
        console.log('   This would prevent users from having multiple bots');
        console.log('   We need to remove this constraint');
      }
    } else {
      console.log('✅ Bot creation successful!');
      console.log('   New bot ID:', newBot.id);
      
      // Clean up the test bot
      await supabase
        .from('bots')
        .delete()
        .eq('id', newBot.id);
      console.log('   Test bot cleaned up');
    }

  } catch (error) {
    console.log('❌ Script failed:', error.message);
  }
}

checkDatabaseState(); 