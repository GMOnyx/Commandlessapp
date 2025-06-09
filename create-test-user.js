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

// Use a fixed UUID for user ID "1" for consistency
const TEST_USER_UUID = '00000000-0000-0000-0000-000000000001';

async function createTestUser() {
  try {
    console.log('🔄 Creating test user...');
    
    // Check if user with the test UUID already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('id', TEST_USER_UUID)
      .single();
    
    if (existingUser) {
      console.log('✅ Test user already exists');
      console.log('👤 User:', existingUser.username);
      console.log('🆔 UUID:', TEST_USER_UUID);
      return TEST_USER_UUID;
    }
    
    // Create user with the fixed UUID
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: TEST_USER_UUID,
        username: 'testuser',
        password: 'hashed_password123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'Admin'
      })
      .select()
      .single();
    
    if (error) {
      // Check if it's a conflict error (user already exists)
      if (error.code === '23505') {
        console.log('✅ Test user already exists (conflict)');
        return TEST_USER_UUID;
      }
      throw new Error(`Failed to create test user: ${error.message}`);
    }
    
    console.log('✅ Test user created successfully!');
    console.log('👤 Username: testuser');
    console.log('🆔 UUID:', TEST_USER_UUID);
    
    return TEST_USER_UUID;
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error.message);
    process.exit(1);
  }
}

// Create test user
createTestUser().then((uuid) => {
  console.log('\n📝 Next step: Update the auth middleware to use this UUID');
  console.log('🔧 The test user UUID is:', uuid);
}); 