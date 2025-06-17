-- Comprehensive database check to see all data
SELECT 'USERS TABLE:' as section;
SELECT * FROM users;

SELECT 'BOTS TABLE:' as section;
SELECT * FROM bots;

SELECT 'COMMAND_MAPPINGS TABLE:' as section;
SELECT * FROM command_mappings;

SELECT 'ACTIVITIES TABLE:' as section;
SELECT * FROM activities ORDER BY created_at DESC LIMIT 10;

-- Count everything
SELECT 'SUMMARY:' as section;
SELECT 'Users:' as table_name, count(*) as count FROM users
UNION ALL
SELECT 'Bots:', count(*) FROM bots
UNION ALL  
SELECT 'Command Mappings:', count(*) FROM command_mappings
UNION ALL
SELECT 'Activities:', count(*) FROM activities; 