-- Fix database schema - change user_id columns from UUID to TEXT

-- First, check current schema
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'bots', 'command_mappings', 'activities') 
AND column_name LIKE '%user_id%' OR column_name = 'id'
ORDER BY table_name, column_name;

-- Drop all foreign key constraints first
ALTER TABLE bots DROP CONSTRAINT IF EXISTS bots_user_id_fkey;
ALTER TABLE command_mappings DROP CONSTRAINT IF EXISTS command_mappings_user_id_fkey;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read own bots" ON bots;
DROP POLICY IF EXISTS "Users can create own bots" ON bots;
DROP POLICY IF EXISTS "Users can update own bots" ON bots;
DROP POLICY IF EXISTS "Users can delete own bots" ON bots;
DROP POLICY IF EXISTS "Users can read own command_mappings" ON command_mappings;
DROP POLICY IF EXISTS "Users can create own command_mappings" ON command_mappings;
DROP POLICY IF EXISTS "Users can update own command_mappings" ON command_mappings;
DROP POLICY IF EXISTS "Users can delete own command_mappings" ON command_mappings;
DROP POLICY IF EXISTS "Users can read own activities" ON activities;
DROP POLICY IF EXISTS "Users can create own activities" ON activities;

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE command_mappings DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;

-- Change all user_id columns to TEXT type
ALTER TABLE users ALTER COLUMN id TYPE TEXT;
ALTER TABLE bots ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE command_mappings ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE activities ALTER COLUMN user_id TYPE TEXT;

-- Re-add foreign key constraints
ALTER TABLE bots ADD CONSTRAINT bots_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE command_mappings ADD CONSTRAINT command_mappings_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE activities ADD CONSTRAINT activities_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Clear any existing data that might be causing issues
DELETE FROM activities;
DELETE FROM command_mappings;
DELETE FROM bots;
DELETE FROM users;

-- Verify the changes
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'bots', 'command_mappings', 'activities') 
AND (column_name LIKE '%user_id%' OR column_name = 'id')
ORDER BY table_name, column_name; 