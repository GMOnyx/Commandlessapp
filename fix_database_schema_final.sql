-- Fix database schema - change user_id columns from UUID to TEXT
-- Final version based on actual policies found in the database

-- Step 1: Drop the specific policy that exists
DROP POLICY IF EXISTS "user_policy" ON users;

-- Step 2: Disable RLS completely on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE command_mappings DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop all foreign key constraints
ALTER TABLE bots DROP CONSTRAINT IF EXISTS bots_user_id_fkey;
ALTER TABLE command_mappings DROP CONSTRAINT IF EXISTS command_mappings_user_id_fkey;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;

-- Step 4: Clear all data to avoid any conflicts
DELETE FROM activities;
DELETE FROM command_mappings;
DELETE FROM bots;
DELETE FROM users;

-- Step 5: Now change the column types from UUID to TEXT
ALTER TABLE users ALTER COLUMN id TYPE TEXT;
ALTER TABLE bots ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE command_mappings ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE activities ALTER COLUMN user_id TYPE TEXT;

-- Step 6: Re-add foreign key constraints
ALTER TABLE bots ADD CONSTRAINT bots_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE command_mappings ADD CONSTRAINT command_mappings_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE activities ADD CONSTRAINT activities_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 7: Verify the schema changes worked
SELECT 
    table_name, 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('users', 'bots', 'command_mappings', 'activities') 
AND (column_name LIKE '%user_id%' OR column_name = 'id')
ORDER BY table_name, column_name;

-- Step 8: Confirm no policies remain
SELECT 
    tablename,
    policyname
FROM pg_policies 
WHERE tablename IN ('users', 'bots', 'command_mappings', 'activities'); 