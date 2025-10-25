import APIKeysPanel from "@/components/APIKeysPanel";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const AI_ONLY = `// index.js — AI-only template
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { RelayClient, useDiscordAdapter } from '@commandless/relay-node';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const relay = new RelayClient({
  apiKey: process.env.COMMANDLESS_API_KEY,
  baseUrl: process.env.COMMANDLESS_SERVICE_URL,
  hmacSecret: process.env.COMMANDLESS_HMAC_SECRET || undefined,
});

useDiscordAdapter({ client, relay, mentionRequired: true });

client.once('ready', async () => {
  try {
    const id = await relay.registerBot({ platform: 'discord', name: client.user.username, clientId: client.user.id });
    if (id && !relay.botId) relay.botId = id;
  } catch {}
  setInterval(async () => { try { await relay.heartbeat(); } catch {} }, 30_000);
});

client.login(process.env.BOT_TOKEN);
`;

const WITH_REGISTRY = `// index.js — Advanced: paste your handlers
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { RelayClient, useDiscordAdapter } from '@commandless/relay-node';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const relay = new RelayClient({
  apiKey: process.env.COMMANDLESS_API_KEY,
  baseUrl: process.env.COMMANDLESS_SERVICE_URL,
});

// PASTE ZONE — registry + handlers
const registry = new Map();
registry.set('pin', { async execute(message) { /* ... */ } });
registry.set('purge', { async execute(message, args) { /* ... */ } });
registry.set('say', { async execute(message, args) { /* ... */ } });

function parseSlashToAction(slash, fallback) { /* same as examples */ }
function runHandler(h, m, a, r) { /* same as examples */ }

useDiscordAdapter({
  client,
  relay,
  mentionRequired: true,
  execute: async (decision, ctx) => {
    const reply = decision?.actions?.find(a => a.kind === 'reply');
    if (reply?.content && ctx.message) await ctx.message.reply({ content: reply.content });
    const cmd = decision?.actions?.find(a => a.kind === 'command');
    if (cmd && ctx.message) {
      const providedSlash = String(cmd.slash || cmd.args?.slash || '').trim();
      let action = String(cmd.name || '').toLowerCase();
      let args = cmd.args || {};
      if (!action || action === 'execute' || providedSlash) {
        const parsed = parseSlashToAction(providedSlash, action);
        action = parsed.action; args = { ...args, ...parsed.args };
      }
      const handler = registry.get(action);
      await runHandler(handler, ctx.message, args, []);
    }
  }
});

client.once('ready', async () => {
  try { const id = await relay.registerBot({ platform: 'discord', name: client.user.username, clientId: client.user.id }); if (id && !relay.botId) relay.botId = id; } catch {}
  setInterval(async () => { try { await relay.heartbeat(); } catch {} }, 30_000);
});

client.login(process.env.BOT_TOKEN);
`;

export default function SDKPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">SDK & API Keys</h1>
        <p className="text-sm text-gray-600 mt-1">Connect your Discord bot to Commandless using our Node SDK. Choose AI‑only or route decisions to your own command registry.</p>
      </div>

      <Card className="p-4 md:p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Environment Variables</h2>
        <ul className="text-sm text-gray-700 list-disc ml-5 space-y-1">
          <li><code>BOT_TOKEN</code> — Discord bot token</li>
          <li><code>COMMANDLESS_API_KEY</code> — from API Keys below</li>
          <li><code>COMMANDLESS_SERVICE_URL</code> — your Railway backend URL</li>
          <li><code>COMMANDLESS_HMAC_SECRET</code> — optional</li>
          <li><code>BOT_ID</code> — optional fixed id for persona</li>
        </ul>
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Index.js Templates</h2>
        <Tabs defaultValue="ai">
          <TabsList>
            <TabsTrigger value="ai">AI‑only</TabsTrigger>
            <TabsTrigger value="advanced">With Registry</TabsTrigger>
          </TabsList>
          <TabsContent value="ai">
            <pre className="overflow-auto bg-gray-900 text-gray-100 p-3 rounded text-xs"><code>{AI_ONLY}</code></pre>
          </TabsContent>
          <TabsContent value="advanced">
            <div className="text-sm text-gray-700 mb-2">Paste your registry and handlers in the highlighted zone. Handlers are the functions that actually run your commands.</div>
            <pre className="overflow-auto bg-gray-900 text-gray-100 p-3 rounded text-xs"><code>{WITH_REGISTRY}</code></pre>
          </TabsContent>
        </Tabs>
      </Card>

      <APIKeysPanel />
    </div>
  );
}


