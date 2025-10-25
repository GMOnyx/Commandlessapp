## Commandless SDK Quick Start

### Prerequisites
- Node.js 18+
- Discord bot token (`BOT_TOKEN`)
- Commandless service URL (`COMMANDLESS_SERVICE_URL`)
- Commandless API key (`COMMANDLESS_API_KEY`)

Optional:
- `COMMANDLESS_HMAC_SECRET`
- `BOT_ID` (if you want to pin a specific backend bot entry)

### Install
```bash
npm i discord.js @commandless/relay-node dotenv
```

### Environment
Create a `.env` next to your `index.js`:
```bash
BOT_TOKEN=your_discord_bot_token
COMMANDLESS_SERVICE_URL=https://your-railway-app.up.railway.app
COMMANDLESS_API_KEY=key:secret:userId[:botId]
# COMMANDLESS_HMAC_SECRET=optional-shared-secret
# BOT_ID=optional-backend-bot-id
```

### Option A: AI-only (no command execution)
Copy `examples/index.ai-only.js` into your bot as `index.js` (or run it directly) and set envs above. This template:
- Registers the bot with the Commandless backend
- Maintains 8-turn per-channel memory and persona binding
- Sends conversational replies only (no command execution)

### Option B: Advanced (paste-zone command execution)
Copy `examples/index.with-registry.js` and paste your handlers in the PASTE ZONE:

Handler shapes supported:
- `{ execute(message, args, rest?) }`
- `{ run(...) }`, `{ messageRun(...) }`, `{ exec(...) }`
- `function ({ message, args, rest }) { ... }`

Examples:
```js
registry.set('pin', {
	async execute(message) {
		let target = null;
		if (message.reference?.messageId) {
			try { target = await message.channel.messages.fetch(message.reference.messageId); } catch {}
		}
		if (!target) {
			const fetched = await message.channel.messages.fetch({ limit: 2 });
			target = fetched.filter(m => m.id !== message.id).first() || fetched.first();
		}
		if (target?.pin) await target.pin().catch(()=>{});
	}
});
registry.set('purge', {
	async execute(message, args) {
		const n = Number(args?.amount || args?.n || args?.count || '0');
		if (n > 0 && 'bulkDelete' in (message.channel)) await (message.channel).bulkDelete(Math.min(n, 100), true).catch(()=>{});
	}
});
registry.set('say', {
	async execute(message, args) {
		const text = String(args?.message || args?.text || args?.content || '').trim();
		if (text) await message.channel.send({ content: text }).catch(()=>{});
	}
});
```

### Testing
- Mention the bot with small-talk → expect AI reply.
- Try "pin this" by replying to a message → expect pin.
- Use dashboard to request command sync (if desired) — the SDK heartbeat will pick up `syncRequested`.

### Security and Ops
- Keep API keys in envs; rotate regularly.
- Ensure HTTPS for all relay traffic.
- Enable basic monitoring on Railway (5xx alerts).
- Pin `@commandless/relay-node` version in your package.json.



