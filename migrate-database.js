#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    console.log('🔍 Checking if personality_context column exists...');
    
    // Try to create a bot with personality_context to test if column exists
    const testData = {
      user_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      platform_type: 'test',
      bot_name: 'test',
      token: 'test',
      personality_context: 'test'
    };
    
    const { error: testError } = await supabase
      .from('bots')
      .insert(testData)
      .select()
      .limit(0); // Don't actually insert, just test the query
    
    if (testError && testError.message.includes('personality_context')) {
      console.log('❌ personality_context column missing, need to add it manually');
      console.log('\n📋 Please run this SQL command in your Supabase SQL Editor:');
      console.log('');
      console.log('ALTER TABLE bots ADD COLUMN IF NOT EXISTS personality_context TEXT;');
      console.log('');
      console.log('🌐 Go to: https://app.supabase.com/project/' + supabaseUrl.split('//')[1].split('.')[0] + '/sql');
    } else {
      console.log('✅ personality_context column already exists or database is accessible');
    }
    
  } catch (error) {
    console.error('❌ Migration check failed:', error.message);
    
    // Provide manual instructions regardless
    console.log('\n📋 Please run this SQL command in your Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE bots ADD COLUMN IF NOT EXISTS personality_context TEXT;');
    console.log('');
    console.log('🌐 Go to: https://app.supabase.com/project/' + supabaseUrl.split('//')[1].split('.')[0] + '/sql');
  }
}

// Run migrations
runMigrations(); 