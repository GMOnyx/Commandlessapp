import APIKeysPanel from "@/components/APIKeysPanel";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SparklesIcon, BotIcon, CodeIcon, KeyIcon, RocketIcon, InfoIcon, CheckCircleIcon, CopyIcon, AlertCircleIcon, ZapIcon } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const AI_ONLY_CODE = `import 'dotenv/config';
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

if (process.env.BOT_ID) {
  relay.botId = process.env.BOT_ID;
  console.log('[boot] Using fixed BOT_ID:', process.env.BOT_ID);
}

useDiscordAdapter({ client, relay, mentionRequired: true });

client.once('ready', async () => {
  console.log(\`✅ Logged in as \${client.user.tag}\`);
  try {
    const id = await relay.registerBot({
      platform: 'discord',
      name: client.user.username,
      clientId: client.user.id,
    });
    if (id && !relay.botId) relay.botId = id;
  } catch (e) {
    console.warn('registerBot error:', e?.message || e);
  }
  setInterval(async () => {
    try { await relay.heartbeat(); } catch {}
  }, 30_000);
});

client.login(process.env.BOT_TOKEN).catch((err) => {
  console.error('❌ Discord login failed:', err?.message || err);
  process.exit(1);
});`;

const WITH_REGISTRY_CODE = `import 'dotenv/config';
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

if (process.env.BOT_ID) {
  relay.botId = process.env.BOT_ID;
  console.log('[boot] Using fixed BOT_ID:', process.env.BOT_ID);
}

// ━━━━━━━━━━━━━━ PASTE ZONE START ━━━━━━━━━━━━━━
// 👉 Paste your command registry + handlers HERE
// 👉 A handler is the function that executes when AI matches your command
// 👉 Example: registry.set('kick', { async execute(message, args) { ... } })

const registry = new Map();

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
    try {
      if (target?.pin) {
        await target.pin();
        await message.reply('✅ Pinned.');
      } else {
        await message.reply('⚠️ Could not find a message to pin.');
      }
    } catch { await message.reply('❌ Failed to pin.'); }
  }
});

registry.set('purge', {
  async execute(message, args) {
    const n = Math.max(0, Math.min(100, Number(args?.amount ?? args?.n ?? 0)));
    if (!n) { await message.reply('Provide an amount 1-100.'); return; }
    try {
      if ('bulkDelete' in message.channel) {
        const res = await message.channel.bulkDelete(n, true);
        await message.reply(\`🧹 Deleted \${res.size} messages.\`);
      } else {
        await message.reply('Channel does not support bulk delete.');
      }
    } catch { await message.reply('❌ Failed to purge.'); }
  }
});

registry.set('say', {
  async execute(message, args) {
    const text = String(args?.message || args?.text || '').trim();
    if (!text) { await message.reply('Provide text to send.'); return; }
    try { await message.channel.send({ content: text }); }
    catch { await message.reply('❌ Failed to send.'); }
  }
});

// ━━━━━━━━━━━━━━ PASTE ZONE END ━━━━━━━━━━━━━━

function pickHandler(action) {
  const key = String(action || '').toLowerCase();
  return registry.get(key) || registry.get(key.toLowerCase());
}

function parseSlashToAction(slash, fallbackName) {
  const clean = String(slash || '').trim();
  if (!clean) return { action: String(fallbackName || '').toLowerCase(), args: {} };
  const without = clean.replace(/^\\//, '');
  const parts = without.split(/\\s+/);
  const action = String(parts.shift() || fallbackName || '').toLowerCase();
  const args = {};
  for (const p of parts) {
    const m = /^([a-zA-Z_][\\w-]*):(.*)$/.exec(p);
    if (m) { args[m[1]] = m[2]; continue; }
    if (!isNaN(Number(p))) { args.amount = Number(p); continue; }
    if (!args.message) { args.message = p; } else { args.message += ' ' + p; }
  }
  return { action, args };
}

async function runHandler(handler, message, args, rest) {
  if (!handler) return false;
  if (typeof handler.execute === 'function') { await handler.execute(message, args, rest); return true; }
  if (typeof handler.run === 'function') { await handler.run(message, args, rest); return true; }
  if (typeof handler.messageRun === 'function') { await handler.messageRun(message, { args, rest }); return true; }
  if (typeof handler.exec === 'function') { await handler.exec(message, rest?.join(' ') ?? ''); return true; }
  if (typeof handler === 'function') { await handler({ message, args, rest }); return true; }
  return false;
}

useDiscordAdapter({
  client,
  relay,
  mentionRequired: true,
  execute: async (decision, ctx) => {
    try {
      const reply = decision?.actions?.find(a => a?.kind === 'reply');
      if (reply?.content) {
        if (ctx?.message) await ctx.message.reply({ content: reply.content }).catch(() => {});
        else if (ctx?.interaction?.isRepliable?.()) await ctx.interaction.reply({ content: reply.content }).catch(() => {});
      }
    } catch {}
    try {
      const command = decision?.actions?.find(a => a?.kind === 'command');
      if (command && ctx?.message) {
        const providedSlash = String(command?.slash || (command?.args?.slash ?? '')).trim();
        let action = String(command?.name || '').toLowerCase();
        let args = command?.args || {};
        if (!action || action === 'execute' || providedSlash) {
          const parsed = parseSlashToAction(providedSlash, action);
          action = parsed.action; args = { ...args, ...parsed.args };
        }
        const handler = pickHandler(action);
        const ok = await runHandler(handler, ctx.message, args, []);
        if (!ok) console.log('[registry] no handler for', action);
      }
    } catch {}
  },
});

client.once('ready', async () => {
  console.log(\`✅ Logged in as \${client.user.tag}\`);
  try {
    const id = await relay.registerBot({
      platform: 'discord',
      name: client.user.username,
      clientId: client.user.id,
    });
    if (id && !relay.botId) relay.botId = id;
  } catch (e) { console.warn('registerBot error:', e?.message || e); }
  setInterval(async () => { try { await relay.heartbeat(); } catch {} }, 30_000);
});

client.login(process.env.BOT_TOKEN).catch((err) => {
  console.error('❌ Discord login failed:', err?.message || err);
  process.exit(1);
});`;

export default function SDKPage() {
  const { toast } = useToast();
  const [copiedAI, setCopiedAI] = useState(false);
  const [copiedRegistry, setCopiedRegistry] = useState(false);

  const copyToClipboard = (text: string, isRegistry: boolean) => {
    navigator.clipboard.writeText(text);
    if (isRegistry) {
      setCopiedRegistry(true);
      setTimeout(() => setCopiedRegistry(false), 2000);
    } else {
      setCopiedAI(true);
      setTimeout(() => setCopiedAI(false), 2000);
    }
    toast({ title: "Copied!", description: "Template copied to clipboard" });
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 text-white shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
              <RocketIcon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Commandless SDK</h1>
              <p className="text-indigo-100 text-sm">Transform your Discord bot with AI-powered natural language</p>
            </div>
          </div>
          <p className="text-lg text-white/90 max-w-2xl">
            Connect your bot in minutes. The SDK forwards messages to Commandless, gets AI decisions, and executes them—all while your bot token stays secure in your app.
          </p>
        </div>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      </div>

      {/* Step-by-step Guide */}
      <Card className="p-6 md:p-8 border-2 border-indigo-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg p-2">
            <CheckCircleIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Quick Setup Guide</h2>
        </div>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-500 text-white font-bold text-lg">1</div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Install the SDK</h3>
              <p className="text-sm text-gray-600 mb-3">Add the Commandless SDK to your bot project alongside discord.js:</p>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm relative">
                <code>npm install discord.js @commandless/relay-node</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText('npm install discord.js @commandless/relay-node');
                    toast({ title: "Copied!", description: "Install command copied" });
                  }}
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-purple-500 text-white font-bold text-lg">2</div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate Your API Key</h3>
              <p className="text-sm text-gray-600 mb-3">Scroll down to the API Keys section and click "New Key". Copy the full key (you'll only see it once!).</p>
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircleIcon className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800">
                  Save your API key immediately—it's shown only once for security.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-pink-500 text-white font-bold text-lg">3</div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Set Environment Variables</h3>
              <p className="text-sm text-gray-600 mb-3">Create or update your <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">.env</code> file with these values:</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <KeyIcon className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold text-gray-900 mb-1">BOT_TOKEN</div>
                      <div className="text-xs text-gray-600">Your Discord bot token from the Developer Portal</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <ZapIcon className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold text-gray-900 mb-1">COMMANDLESS_API_KEY</div>
                      <div className="text-xs text-gray-600">The API key you just created (format: ck_xxxxx:cs_xxxxx)</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <RocketIcon className="h-5 w-5 text-pink-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold text-gray-900 mb-1">COMMANDLESS_SERVICE_URL</div>
                      <div className="text-xs text-gray-600">Your backend service URL (e.g., https://your-app.railway.app)</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <InfoIcon className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold text-gray-700 mb-1">BOT_ID <Badge variant="outline" className="ml-2">Optional</Badge></div>
                      <div className="text-xs text-gray-600">Lock to a specific bot row for consistent persona (get from dashboard)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-500 text-white font-bold text-lg">4</div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose Your Integration Mode</h3>
              <p className="text-sm text-gray-600 mb-4">Pick the template that matches your bot's needs:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-2 border-indigo-200 rounded-lg p-4 bg-gradient-to-br from-indigo-50 to-purple-50 hover:border-indigo-400 transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <SparklesIcon className="h-5 w-5 text-indigo-600" />
                    <div className="font-semibold text-gray-900">AI-Only Mode</div>
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed">
                    Perfect for conversational bots. Your bot responds naturally to user messages using AI. No local command execution needed. Just copy, paste, and run!
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Easiest</Badge>
                    <Badge variant="outline">Minimal setup</Badge>
                  </div>
                </div>
                <div className="border-2 border-purple-200 rounded-lg p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:border-purple-400 transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <CodeIcon className="h-5 w-5 text-purple-600" />
                    <div className="font-semibold text-gray-900">With Command Registry</div>
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed">
                    For power users. AI understands natural language AND routes command actions to your existing handlers. Paste your registry + handlers in the highlighted zone.
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Advanced</Badge>
                    <Badge variant="outline">Full control</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Code Templates */}
      <Card className="overflow-hidden border-2 border-gray-200">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CodeIcon className="h-6 w-6 text-indigo-600" />
            index.js Templates
          </h2>
          <p className="text-sm text-gray-600 mt-1">Copy the template that matches your choice from Step 4.</p>
        </div>
        <div className="p-6">
          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <SparklesIcon className="h-4 w-4" />
                AI-Only
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <CodeIcon className="h-4 w-4" />
                With Registry
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="ai" className="space-y-4">
              <Alert className="bg-indigo-50 border-indigo-200">
                <SparklesIcon className="h-4 w-4 text-indigo-600" />
                <AlertDescription className="text-sm text-indigo-900">
                  <strong>AI-Only:</strong> This template gives your bot conversational AI replies. No command execution happens locally—just pure AI personality and responses.
                </AlertDescription>
              </Alert>
              <div className="relative">
                <pre className="overflow-auto bg-gray-900 text-gray-100 p-4 rounded-lg text-xs leading-relaxed max-h-96">
                  <code>{AI_ONLY_CODE}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-3 right-3 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => copyToClipboard(AI_ONLY_CODE, false)}
                >
                  {copiedAI ? <CheckCircleIcon className="h-4 w-4 mr-1" /> : <CopyIcon className="h-4 w-4 mr-1" />}
                  {copiedAI ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="advanced" className="space-y-4">
              <Alert className="bg-purple-50 border-purple-200">
                <CodeIcon className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-sm text-purple-900">
                  <strong>With Registry:</strong> AI understands natural language AND routes command decisions to your existing handlers. Look for <code className="bg-purple-200 px-1 rounded">PASTE ZONE</code> in the code below—that's where you paste your registry entries + handler functions.
                </AlertDescription>
              </Alert>
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
                <div className="flex items-start gap-3">
                  <AlertCircleIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-900">
                    <strong className="font-semibold">What's a handler?</strong> A handler is the actual function that runs your command logic (e.g., <code className="bg-amber-200 px-1 rounded">async execute(message, args)</code>). You paste BOTH the registry entries AND the handler functions inside the paste zone. See the example handlers for pin/purge/say already included.
                  </div>
                </div>
              </div>
              <div className="relative">
                <pre className="overflow-auto bg-gray-900 text-gray-100 p-4 rounded-lg text-xs leading-relaxed max-h-[500px]">
                  <code>{WITH_REGISTRY_CODE}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-3 right-3 bg-purple-600 hover:bg-purple-700"
                  onClick={() => copyToClipboard(WITH_REGISTRY_CODE, true)}
                >
                  {copiedRegistry ? <CheckCircleIcon className="h-4 w-4 mr-1" /> : <CopyIcon className="h-4 w-4 mr-1" />}
                  {copiedRegistry ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-900 space-y-2">
                  <div className="font-semibold flex items-center gap-2">
                    <InfoIcon className="h-4 w-4" />
                    Key Points:
                  </div>
                  <ul className="list-disc ml-5 space-y-1 text-xs">
                    <li>Registry keys must match your command names (e.g., 'pin', 'purge', 'say')</li>
                    <li>Each handler has an <code className="bg-blue-200 px-1 rounded">execute</code> function that receives message and args</li>
                    <li>The example handlers (pin/purge/say) are ready to use—keep or replace with your own</li>
                    <li>Don't modify code outside the paste zone unless you know what you're doing</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      {/* What Happens Next */}
      <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-500 rounded-lg p-2">
            <BotIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">What Happens Next?</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">1</div>
              User mentions bot
            </div>
            <div className="text-xs text-gray-600">User says "@bot delete 5 messages" or replies to your bot with a command or question.</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">2</div>
              AI decides
            </div>
            <div className="text-xs text-gray-600">SDK sends the message to Commandless. AI understands intent and returns a decision (reply or command).</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">3</div>
              Bot executes
            </div>
            <div className="text-xs text-gray-600">SDK sends the AI reply or routes the command to your handler. Bot responds instantly.</div>
          </div>
        </div>
      </Card>

      {/* API Keys Management */}
      <div id="api-keys-section">
        <APIKeysPanel />
      </div>

      {/* Troubleshooting */}
      <Card className="p-6 bg-gray-50 border-2 border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertCircleIcon className="h-5 w-5 text-gray-700" />
          Troubleshooting
        </h2>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-semibold text-gray-900">Bot not responding?</div>
            <div className="text-xs text-gray-600 ml-4">• Ensure MessageContent intent is enabled in Discord Developer Portal<br />• Check that COMMANDLESS_SERVICE_URL points to your backend<br />• Verify the bot has permission to read/send messages in the channel</div>
          </div>
          <div>
            <div className="font-semibold text-gray-900">Personality not loading?</div>
            <div className="text-xs text-gray-600 ml-4">• Set BOT_ID in .env to match the bot in your dashboard<br />• Ensure your API key belongs to the same user who owns that bot<br />• Add a personality in the dashboard's bot settings</div>
          </div>
          <div>
            <div className="font-semibold text-gray-900">Commands not executing?</div>
            <div className="text-xs text-gray-600 ml-4">• (Advanced mode) Check that registry keys match your command names<br />• Ensure handlers have an execute/run function<br />• Check bot has required Discord permissions (e.g., Manage Messages for purge)</div>
          </div>
        </div>
      </Card>
    </div>
  );
}


