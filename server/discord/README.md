# Discord Webhook Integration

This directory contains the code for the Discord webhook integration for the Commandless app.

## Overview

The Discord webhook integration allows your bots to process messages from Discord servers using natural language understanding. Instead of relying on strict command prefixes like `!command`, users can interact with your bot using natural language.

## Files

- `webhook.ts` - Main webhook handler for Discord interactions
- `messageHandler.ts` - Processes Discord messages and finds matching commands
- `naturalLanguageProcessor.ts` - Matches input against command patterns
- `verifySignature.ts` - Verifies webhook signatures from Discord

## Deployment

### Option 1: Self-Hosted With Your Existing Server

1. The webhook is already integrated into your Express server at `/api/webhooks/discord`
2. Expose your server to the internet using a service like ngrok or deploy it to a cloud provider
3. Configure your Discord bot to send webhook events to your endpoint

### Option 2: Deploying as a Standalone Serverless Function

You can deploy this as a standalone serverless function on platforms like Vercel, Netlify, or AWS Lambda:

#### Vercel Deployment

1. Create a new `api` directory in your project root
2. Create a file `api/discord.js` with the following content:

```js
import { discordWebhookHandler } from '../server/discord/webhook';

export default async function handler(req, res) {
  return await discordWebhookHandler(req, res);
}
```

3. Deploy to Vercel with `vercel deploy`
4. Your webhook will be available at `https://your-app.vercel.app/api/discord`

#### Netlify Deployment

1. Create a `netlify/functions` directory in your project root
2. Create a file `netlify/functions/discord.js` with:

```js
const { discordWebhookHandler } = require('../../server/discord/webhook');

exports.handler = async function(event, context) {
  // Convert Netlify event to Express-like request/response
  const req = {
    body: JSON.parse(event.body),
    headers: event.headers
  };
  
  let statusCode = 200;
  let responseBody = {};
  
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (body) => { responseBody = body; return res; }
  };
  
  await discordWebhookHandler(req, res);
  
  return {
    statusCode,
    body: JSON.stringify(responseBody)
  };
};
```

3. Deploy to Netlify with `netlify deploy`
4. Your webhook will be available at `https://your-app.netlify.app/.netlify/functions/discord`

## Discord Bot Configuration

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to the "Bot" tab and create a bot if you haven't already
4. Under "Privileged Gateway Intents", enable "Message Content Intent"
5. Go to the "General Information" tab and copy your "Public Key"
6. Set the following environment variables in your deployment:
   ```
   DISCORD_PUBLIC_KEY=your_public_key
   VERIFY_DISCORD_SIGNATURE=true
   ```
7. Under the "OAuth2" tab, generate an invite URL with the following permissions:
   - `bot`
   - `applications.commands`
   - Necessary bot permissions: Send Messages, Read Messages, etc.
8. Invite the bot to your server

## Interaction Endpoint URL

1. In the Discord Developer Portal, under your application's "General Information":
2. Find "INTERACTIONS ENDPOINT URL" 
3. Enter your webhook URL (e.g., `https://your-app.vercel.app/api/discord`)
4. Discord will send a test request to verify your endpoint works

## Testing

You can test your webhook integration using the built-in test endpoint:

```
POST /api/discord/process-message
{
  "message": "Ban user123 for spamming",
  "guildId": "your_guild_id",
  "channelId": "your_channel_id"
}
```

This endpoint requires authentication. 