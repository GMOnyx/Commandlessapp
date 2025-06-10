-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Commandless App Database Setup
-- Run this in your Supabase SQL Editor to create all required tables

-- Enable Row Level Security by default
-- Note: Adjust RLS policies as needed for your security requirements

-- Users table (stores Clerk user data)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,  -- Clerk user ID
    username TEXT UNIQUE NOT NULL,
    password TEXT DEFAULT 'clerk_managed',
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bots table (stores connected Discord bots)
CREATE TABLE IF NOT EXISTS bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform_type TEXT DEFAULT 'discord',
    bot_name TEXT NOT NULL,
    token TEXT, -- Encrypted bot token
    client_id TEXT,
    personality_context TEXT DEFAULT 'A helpful Discord bot that responds conversationally.',
    is_connected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Command mappings table (stores natural language -> Discord command mappings)
CREATE TABLE IF NOT EXISTS command_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    natural_language_pattern TEXT NOT NULL, -- e.g., "ban that user for being toxic"
    command_output TEXT NOT NULL, -- e.g., "/ban @user being toxic"
    status TEXT DEFAULT 'active',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table (stores user activity logs)
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'command_used', 'bot_connected', etc.
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

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic - users can only access their own data)
-- Note: Adjust these policies based on your specific security requirements

-- Users policies
CREATE POLICY IF NOT EXISTS "Users can view their own data" ON users
    FOR SELECT USING (id = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Users can update their own data" ON users
    FOR UPDATE USING (id = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Users can insert their own data" ON users
    FOR INSERT WITH CHECK (id = auth.uid()::text);

-- Bots policies
CREATE POLICY IF NOT EXISTS "Users can view their own bots" ON bots
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Users can manage their own bots" ON bots
    FOR ALL USING (user_id = auth.uid()::text);

-- Command mappings policies
CREATE POLICY IF NOT EXISTS "Users can view their own mappings" ON command_mappings
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Users can manage their own mappings" ON command_mappings
    FOR ALL USING (user_id = auth.uid()::text);

-- Activities policies
CREATE POLICY IF NOT EXISTS "Users can view their own activities" ON activities
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Users can create their own activities" ON activities
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Insert a sample user for testing (optional)
-- Replace 'your_clerk_user_id' with an actual Clerk user ID
INSERT INTO users (id, username, name, role) 
VALUES ('demo_user', 'demo_user', 'Demo User', 'user') 
ON CONFLICT (id) DO NOTHING;

-- Insert sample data for testing (optional)
INSERT INTO bots (user_id, bot_name, platform_type, is_connected)
VALUES ('demo_user', 'My Discord Bot', 'discord', false)
ON CONFLICT DO NOTHING;

-- Get the bot ID for the sample command mapping
DO $$
DECLARE
    sample_bot_id UUID;
BEGIN
    SELECT id INTO sample_bot_id FROM bots WHERE user_id = 'demo_user' LIMIT 1;
    
    IF sample_bot_id IS NOT NULL THEN
        INSERT INTO command_mappings (user_id, bot_id, name, natural_language_pattern, command_output)
        VALUES ('demo_user', sample_bot_id, 'Ban User', 'ban %user% for %reason%', '/ban %user% %reason%')
        ON CONFLICT DO NOTHING;
        
        INSERT INTO activities (user_id, activity_type, description)
        VALUES ('demo_user', 'bot_connected', 'Connected Discord bot successfully')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Display success message
SELECT 'Database setup completed successfully!' AS status; 