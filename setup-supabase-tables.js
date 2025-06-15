import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database tables...');
  
  try {
    // Create tables using the SQL from setup-database.sql
    const setupSQL = `
      -- Enable UUID extension if not already enabled
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Users table (stores Clerk user data)
      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT DEFAULT 'clerk_managed',
          name TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Bots table (stores connected Discord/Telegram bots)
      CREATE TABLE IF NOT EXISTS bots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          platform_type TEXT DEFAULT 'discord',
          bot_name TEXT NOT NULL,
          token TEXT,
          client_id TEXT,
          personality_context TEXT DEFAULT 'A helpful bot that responds conversationally.',
          is_connected BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Command mappings table
      CREATE TABLE IF NOT EXISTS command_mappings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          natural_language_pattern TEXT NOT NULL,
          command_output TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          usage_count INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Activities table
      CREATE TABLE IF NOT EXISTS activities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          activity_type TEXT NOT NULL,
          description TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
      CREATE INDEX IF NOT EXISTS idx_command_mappings_user_id ON command_mappings(user_id);
      CREATE INDEX IF NOT EXISTS idx_command_mappings_bot_id ON command_mappings(bot_id);
      CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
      CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
    `;

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql: setupSQL });
    
    if (error) {
      console.error('❌ Database setup failed:', error);
      process.exit(1);
    }

    console.log('✅ Database tables created successfully!');
    
    // Test the connection by checking if tables exist
    const { data: tables, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
      
    if (testError) {
      console.error('❌ Database test failed:', testError);
      process.exit(1);
    }
    
    console.log('✅ Database connection test passed!');
    console.log('🎉 Your Commandless database is ready!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupDatabase(); 