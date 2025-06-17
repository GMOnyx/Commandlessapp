-- Clean up sample data that was incorrectly added
-- Run this in your Supabase SQL Editor

-- Delete all data for demo_user
DELETE FROM activities WHERE user_id = 'demo_user';
DELETE FROM command_mappings WHERE user_id = 'demo_user';
DELETE FROM bots WHERE user_id = 'demo_user';
DELETE FROM users WHERE id = 'demo_user';

-- If there are any Telegram bots that shouldn't be there for your account, 
-- you can delete them by running:
-- DELETE FROM bots WHERE platform_type = 'telegram' AND user_id = 'YOUR_ACTUAL_USER_ID';

-- Check what's left
SELECT 'Cleanup completed. Remaining data:' as status;
SELECT 'Users:' as table_name, count(*) as count FROM users
UNION ALL
SELECT 'Bots:', count(*) FROM bots
UNION ALL
SELECT 'Command Mappings:', count(*) FROM command_mappings
UNION ALL
SELECT 'Activities:', count(*) FROM activities; 