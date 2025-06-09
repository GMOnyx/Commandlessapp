import { createClient } from '@supabase/supabase-js';
import { log } from './vite';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  log('Supabase credentials not found in environment variables', 'error');
}

// Only create a real client if USE_SUPABASE is true
export const supabase = process.env.USE_SUPABASE === 'true' 
  ? createClient(supabaseUrl, supabaseKey)
  : {
    // Mock Supabase client for when Supabase is disabled
    from: () => {
      const mockResponse = { data: null, error: new Error('Supabase is disabled') };
      const mockBuilder = {
        ...mockResponse,
        select: () => mockBuilder,
        insert: () => mockBuilder,
        update: () => mockBuilder,
        delete: () => mockBuilder,
        eq: () => mockBuilder,
        neq: () => mockBuilder,
        limit: () => mockBuilder,
        single: () => mockResponse,
        order: () => mockBuilder,
      };
      return mockBuilder;
    },
    rpc: () => ({ data: null, error: new Error('Supabase is disabled') }),
  };

// Initialize Supabase and check connection
export async function initSupabase(): Promise<void> {
  // Skip if Supabase is disabled
  if (process.env.USE_SUPABASE !== 'true') {
    log('Supabase is disabled, skipping initialization', 'info');
    return;
  }
  
  try {
    // Attempt to make a simple query to test the connection
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      log(`Failed to connect to Supabase: ${error.message}`, 'error');
      throw error;
    }
    
    log('Successfully connected to Supabase database', 'info');
    
    // Create tables if they don't exist
    await verifyTables();
  } catch (error) {
    log(`Supabase initialization error: ${(error as Error).message}`, 'error');
    throw error;
  }
}

// Function to verify tables exist (or create them if they don't)
async function verifyTables() {
  // This is simplified for development purposes
  // In production, we would use proper migrations
  
  try {
    // Try to query users table to see if it exists
    const { error: checkError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    // If we get a specific error about the table not existing, create the tables
    if (checkError && checkError.message.includes('does not exist')) {
      log('Creating database tables...', 'info');
      
      // Create users table with UUID primary key
      await supabase.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            email TEXT UNIQUE,
            role TEXT,
            avatar TEXT
          );
        `
      });
      
      // Create bots table with UUID primary key and foreign key to users
      await supabase.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS bots (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id),
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
      
      // Create command_mappings table with UUID primary key and foreign keys
      await supabase.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS command_mappings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id),
            bot_id UUID NOT NULL REFERENCES bots(id),
            name TEXT NOT NULL,
            natural_language_pattern TEXT NOT NULL,
            command_output TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            usage_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `
      });
      
      // Create activities table with UUID primary key and foreign key to users
      await supabase.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS activities (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id),
            activity_type TEXT NOT NULL,
            description TEXT NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `
      });
      
      log('Database tables created successfully', 'info');
    } else {
      log('Database tables already exist', 'info');
      
      // Run migrations to ensure all columns exist
      await runMigrations();
    }
  } catch (error) {
    log(`Error verifying/creating tables: ${(error as Error).message}`, 'error');
    throw error;
  }
}

// Function to run migrations for existing tables
async function runMigrations() {
  try {
    // Migration: Add personality_context column to bots table if it doesn't exist
    const { error: personalityError } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE bots 
        ADD COLUMN IF NOT EXISTS personality_context TEXT;
      `
    });
    
    if (personalityError) {
      log(`Migration warning (personality_context): ${personalityError.message}`, 'warn');
    } else {
      log('Migration: personality_context column verified for bots table', 'info');
    }
    
    // Future migrations can be added here
    
  } catch (error) {
    log(`Migration error: ${(error as Error).message}`, 'warn');
    // Don't throw - migrations are non-critical for existing functionality
  }
} 