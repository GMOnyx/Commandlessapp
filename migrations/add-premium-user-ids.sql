-- Add premium_user_ids column to track global premium Discord user IDs
ALTER TABLE bot_configurations
ADD COLUMN IF NOT EXISTS premium_user_ids JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN bot_configurations.premium_user_ids IS 'List of Discord user IDs treated as premium across all servers';

