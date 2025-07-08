# Force Railway redeploy Thu Jun 26 00:07:20 +04 2025

## Force Deploy

Railway deployment trigger - Updated Jan 8, 2025 13:11 UTC

This deployment should:
1. Use the start script: `cd server && npm install && node simple-index.js`
2. Start the Node.js API server instead of serving static files
3. Connect to Supabase using the pooler for IPv4 compatibility
