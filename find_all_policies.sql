-- First, let's see what policies actually exist in the database
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('users', 'bots', 'command_mappings', 'activities')
ORDER BY tablename, policyname; 