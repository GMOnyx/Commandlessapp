-- Complete API Keys Table Setup and Cleanup
-- Run this in your Supabase SQL Editor to ensure everything is correct

-- Step 1: Check current api_keys table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;

-- Step 2: Determine bots.id type
DO $$
DECLARE
    bot_id_type TEXT;
BEGIN
    SELECT data_type INTO bot_id_type
    FROM information_schema.columns
    WHERE table_name = 'bots' AND column_name = 'id'
    LIMIT 1;
    
    RAISE NOTICE 'bots.id type: %', bot_id_type;
END $$;

-- Step 3: Add bot_id column to api_keys if it doesn't exist
DO $$
DECLARE
    bot_id_type TEXT;
BEGIN
    -- Get the data type of bots.id
    SELECT data_type INTO bot_id_type
    FROM information_schema.columns
    WHERE table_name = 'bots' AND column_name = 'id'
    LIMIT 1;
    
    -- Check if bot_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' AND column_name = 'bot_id'
    ) THEN
        -- Add column with appropriate type based on bots.id
        IF bot_id_type = 'uuid' THEN
            ALTER TABLE api_keys ADD COLUMN bot_id UUID;
            RAISE NOTICE 'Added bot_id column (UUID type) to api_keys table';
        ELSIF bot_id_type = 'integer' OR bot_id_type = 'bigint' OR bot_id_type = 'int4' THEN
            ALTER TABLE api_keys ADD COLUMN bot_id INTEGER;
            RAISE NOTICE 'Added bot_id column (INTEGER type) to api_keys table';
        ELSE
            ALTER TABLE api_keys ADD COLUMN bot_id INTEGER;
            RAISE NOTICE 'Added bot_id column (INTEGER type, default) to api_keys table';
        END IF;
    ELSE
        RAISE NOTICE 'bot_id column already exists in api_keys table';
    END IF;
END $$;

-- Step 4: Make bot_id nullable (important!)
DO $$
BEGIN
    -- Check if column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'bot_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE api_keys ALTER COLUMN bot_id DROP NOT NULL;
        RAISE NOTICE 'Made bot_id column nullable';
    ELSE
        RAISE NOTICE 'bot_id column is already nullable or does not exist';
    END IF;
END $$;

-- Step 5: Add foreign key constraint if it doesn't exist
DO $$
DECLARE
    bot_id_type TEXT;
BEGIN
    SELECT data_type INTO bot_id_type
    FROM information_schema.columns
    WHERE table_name = 'bots' AND column_name = 'id'
    LIMIT 1;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'api_keys_bot_id_fkey' 
        AND table_name = 'api_keys'
    ) THEN
        ALTER TABLE api_keys 
        ADD CONSTRAINT api_keys_bot_id_fkey 
        FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key constraint added';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;
END $$;

-- Step 6: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_bot_id ON api_keys(bot_id) WHERE bot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at) WHERE revoked_at IS NOT NULL;

-- Step 7: Verify the final structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;

-- Step 8: Show current API keys and their bot_id status
SELECT 
    key_id,
    user_id,
    bot_id,
    revoked_at IS NOT NULL as is_revoked,
    expires_at,
    created_at
FROM api_keys
ORDER BY created_at DESC;

-- Step 9: Cleanup - Remove any revoked/expired keys older than 90 days (optional)
-- Uncomment if you want to clean up old keys:
-- DELETE FROM api_keys 
-- WHERE (revoked_at IS NOT NULL OR (expires_at IS NOT NULL AND expires_at < NOW()))
-- AND created_at < NOW() - INTERVAL '90 days';

