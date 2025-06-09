-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table 
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  email TEXT UNIQUE,
  role TEXT,
  avatar TEXT
);

-- Bots table with reference to users
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  platform_type TEXT NOT NULL,
  bot_name TEXT NOT NULL,
  token TEXT NOT NULL,
  client_id TEXT,
  personality_context TEXT, -- Optional: Custom bot personality and context
  is_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Command mappings table with references to users and bots
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

-- Activities table with reference to users
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert a sample user for testing
INSERT INTO users (username, password, name, email, role)
VALUES ('testuser', 'password123', 'Test User', 'test@example.com', 'user')
ON CONFLICT (username) DO NOTHING;

-- For development purposes, disable RLS
-- In production, you would want to enable these policies
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE command_mappings DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;

-- The following policies are commented out for development
-- Uncomment and enable for production use

/*
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users policy - only allow users to see their own data
CREATE POLICY users_policy ON users
  USING (auth.uid() = id);

-- Bots policy - only allow users to see their own bots
CREATE POLICY bots_policy ON bots
  USING (user_id IN (SELECT id FROM users WHERE id = auth.uid()));

-- Command mappings policy - only allow users to see their own command mappings
CREATE POLICY command_mappings_policy ON command_mappings
  USING (user_id IN (SELECT id FROM users WHERE id = auth.uid()));

-- Activities policy - only allow users to see their own activities
CREATE POLICY activities_policy ON activities
  USING (user_id IN (SELECT id FROM users WHERE id = auth.uid()));
*/ 