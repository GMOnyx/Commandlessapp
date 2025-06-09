import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTables() {
  console.log('🔧 Setting up database tables...');

  try {
    // Create users table
    const { error: usersError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT,
          email TEXT UNIQUE,
          role TEXT DEFAULT 'user',
          avatar TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (usersError && !usersError.message.includes('already exists')) {
      console.warn('Note: Could not create users table via RPC, it may already exist');
    }

    // Create bots table
    const { error: botsError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS bots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          platform_type TEXT NOT NULL,
          bot_name TEXT NOT NULL,
          token TEXT NOT NULL,
          client_id TEXT,
          personality_context TEXT,
          is_connected BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (botsError && !botsError.message.includes('already exists')) {
      console.warn('Note: Could not create bots table via RPC, it may already exist');
    }

    // Create command_mappings table
    const { error: mappingsError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS command_mappings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          bot_id UUID NOT NULL,
          name TEXT NOT NULL,
          natural_language_pattern TEXT NOT NULL,
          command_output TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          usage_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (mappingsError && !mappingsError.message.includes('already exists')) {
      console.warn('Note: Could not create command_mappings table via RPC, it may already exist');
    }

    // Create activities table
    const { error: activitiesError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS activities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          activity_type TEXT NOT NULL,
          description TEXT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (activitiesError && !activitiesError.message.includes('already exists')) {
      console.warn('Note: Could not create activities table via RPC, it may already exist');
    }

    console.log('✅ Database setup completed!');
    
    // Test connection by checking if we can query the users table
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .limit(1);

    if (error) {
      console.log('⚠️  Could not query users table. You may need to create tables manually in Supabase.');
      console.log('Use the SQL commands from setup-database.sql in your Supabase SQL editor.');
    } else {
      console.log('✅ Tables are accessible and ready!');
    }

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.log('');
    console.log('📝 Manual setup required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Open the SQL Editor');
    console.log('3. Run the SQL commands from setup-database.sql');
    console.log('');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTables();
}

export { setupTables }; 