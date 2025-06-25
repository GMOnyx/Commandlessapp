#!/bin/bash

echo "🚀 Deploying Universal Discord Relay Service to Railway"
echo "=================================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Please login to Railway first:"
    echo "   railway login"
    exit 1
fi

echo "✅ Railway CLI found and authenticated"

# Create new Railway project
echo "📦 Creating new Railway project..."
railway create "commandless-universal-relay"

# Set environment variables
echo "⚙️ Setting environment variables..."

# You'll need to replace these with your actual values
echo "📝 Please provide your environment variables:"

read -p "🔑 Supabase URL: " SUPABASE_URL
read -p "🔑 Supabase Anon Key: " SUPABASE_ANON_KEY
read -p "🌐 Commandless API URL (default: https://commandless.app): " COMMANDLESS_API_URL

# Set default if empty
if [ -z "$COMMANDLESS_API_URL" ]; then
    COMMANDLESS_API_URL="https://commandless.app"
fi

# Set environment variables
railway env set SUPABASE_URL="$SUPABASE_URL"
railway env set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
railway env set COMMANDLESS_API_URL="$COMMANDLESS_API_URL"
railway env set NODE_ENV="production"

echo "✅ Environment variables set"

# Copy files for deployment
echo "📁 Preparing deployment files..."
cp universal-relay-service.js relay-deploy/
cp package.relay.json relay-deploy/package.json
cp railway.relay.toml relay-deploy/railway.toml

cd relay-deploy

# Deploy
echo "🚀 Deploying to Railway..."
railway deploy

echo ""
echo "🎉 Deployment complete!"
echo "🔗 Your relay service should be running on Railway"
echo "📊 Check status at: railway dashboard"
echo ""
echo "📋 Next steps:"
echo "   1. Verify deployment in Railway dashboard"
echo "   2. Check logs: railway logs"
echo "   3. Test health endpoint: curl https://your-service.railway.app/health"
echo "   4. Your bots should now respond to mentions automatically!"
echo ""
echo "🤖 All connected bots in your database will start working immediately" 