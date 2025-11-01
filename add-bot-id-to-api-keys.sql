-- Add bot_id column to api_keys table for BOT_ID binding
-- Run this in your Supabase SQL Editor

-- Step 1: Create api_keys table if it doesn't exist
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_id TEXT UNIQUE NOT NULL,
    secret_hash TEXT NOT NULL,
    user_id TEXT NOT NULL,
    scopes TEXT[] DEFAULT ARRAY['relay.events.write'],
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    rate_limit_per_min INTEGER
);

-- Step 2: Check bots.id type and add bot_id column accordingly
DO $$
DECLARE
    bot_id_type TEXT;
BEGIN
    -- Get the data type of bots.id
    SELECT data_type INTO bot_id_type
    FROM information_schema.columns
    WHERE table_name = 'bots' AND column_name = 'id'
    LIMIT 1;
    
    -- Add bot_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' AND column_name = 'bot_id'
    ) THEN
        -- Add column with appropriate type based on bots.id
        IF bot_id_type = 'uuid' THEN
            ALTER TABLE api_keys ADD COLUMN bot_id UUID;
            RAISE NOTICE 'Added bot_id column (UUID type) to api_keys table';
        ELSIF bot_id_type = 'integer' OR bot_id_type = 'bigint' THEN
            ALTER TABLE api_keys ADD COLUMN bot_id INTEGER;
            RAISE NOTICE 'Added bot_id column (INTEGER type) to api_keys table';
        ELSE
            -- Default to INTEGER if type is unknown
            ALTER TABLE api_keys ADD COLUMN bot_id INTEGER;
            RAISE NOTICE 'Added bot_id column (INTEGER type, default) to api_keys table';
        END IF;
        
        RAISE NOTICE 'bot_id column added successfully';
    ELSE
        RAISE NOTICE 'bot_id column already exists in api_keys table';
    END IF;
END $$;

-- Step 3: Add foreign key constraint (if it doesn't exist)
DO $$
BEGIN
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

-- Step 4: Add indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_api_keys_bot_id ON api_keys(bot_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);

-- Step 5: Verify the setup
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
AND column_name IN ('bot_id', 'key_id', 'user_id')
ORDER BY column_name;
