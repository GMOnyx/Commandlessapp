-- Make bot_id nullable in api_keys table
-- Run this in your Supabase SQL Editor

ALTER TABLE api_keys 
ALTER COLUMN bot_id DROP NOT NULL;

-- Verify the change
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
AND column_name = 'bot_id';

