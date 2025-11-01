import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SparklesIcon, CodeIcon, RocketIcon, CopyIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function SDKPage() {
  const { toast } = useToast();
  const [selectedIntegration, setSelectedIntegration] = useState<'ai-only' | 'command-execution' | null>(null);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Command copied to clipboard" });
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="rounded-xl bg-white/60 backdrop-blur-xl border border-gray-200/50 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-indigo-500/10 rounded-lg p-2">
            <RocketIcon className="h-7 w-7 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">Commandless SDK</h1>
          </div>
        </div>
        <p className="text-base text-gray-600 max-w-2xl">
          Transform your Discord bot with AI-powered natural language. Connect in minutes—your bot token stays secure in your app.
        </p>
      </div>

      {/* Choose Your Integration */}
      <Card className="p-6 md:p-8 border border-gray-200/50 shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Choose Your Integration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setSelectedIntegration('ai-only')}
            className={`border rounded-lg p-6 bg-white text-left transition-all ${
              selectedIntegration === 'ai-only'
                ? 'border-indigo-300 shadow-md ring-2 ring-indigo-100'
                : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${
                selectedIntegration === 'ai-only' ? 'bg-indigo-100' : 'bg-indigo-50'
              }`}>
                <SparklesIcon className={`h-5 w-5 ${
                  selectedIntegration === 'ai-only' ? 'text-indigo-600' : 'text-indigo-500'
                }`} />
              </div>
              <div className="font-medium text-gray-900 text-lg">AI Only</div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              Conversational AI replies only. No command execution. Minimal setup.
            </p>
            <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 text-xs">Recommended</Badge>
          </button>

          <div
            className={`border rounded-lg p-6 bg-white text-left transition-all cursor-not-allowed opacity-60 ${
              'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <CodeIcon className="h-5 w-5 text-gray-400" />
              </div>
              <div className="font-medium text-gray-900 text-lg">Command Execution</div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              Route parsed commands to your custom handlers.
            </p>
            <Badge variant="outline" className="text-xs">Coming Soon</Badge>
          </div>
        </div>
      </Card>

      {/* AI Only Steps */}
      {selectedIntegration === 'ai-only' && (
        <Card className="p-6 md:p-8 border border-gray-200/50 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">AI Only Setup</h2>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-medium text-sm">1</div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-medium text-gray-900 mb-2">Install the SDK</h3>
                <p className="text-sm text-gray-600 mb-3">Add the SDK to your bot project:</p>
                <div className="bg-gray-800 text-gray-100 p-4 rounded-lg font-mono text-sm relative">
                  <code>npm install @abdarrahmanabdelnasir/relay-node</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                    onClick={() => copyToClipboard('npm install @abdarrahmanabdelnasir/relay-node')}
                  >
                    {copied ? <CheckCircleIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Note: If you don't already have <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">discord.js</code> installed, you'll need it as well: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">npm install discord.js</code>
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-medium text-sm">2</div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-medium text-gray-900 mb-2">Run from Terminal</h3>
                <p className="text-sm text-gray-600 mb-3">Run the bot using the CLI command. Set up your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code> file with:</p>
                <div className="bg-gray-800 text-gray-100 p-4 rounded-lg font-mono text-sm relative mb-3">
                  <code>npx commandless-discord</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                    onClick={() => copyToClipboard('npx commandless-discord')}
                  >
                    {copied ? <CheckCircleIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <code className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200">BOT_TOKEN</code>
                    <span className="text-xs text-gray-600">Discord bot token</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200">COMMANDLESS_API_KEY</code>
                    <span className="text-xs text-gray-600">From API Keys page (ck_xxxxx:cs_xxxxx)</span>
                  </div>
                  <div className="text-xs text-gray-500 italic mt-2">
                    Note: SERVICE_URL is optional and defaults to the Commandless backend service.
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-medium text-sm">3</div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-medium text-gray-900 mb-2">You're Good to Go!</h3>
                <p className="text-sm text-gray-600">
                  Your bot is now running with AI-powered natural language processing. The bot will automatically use the personality and configuration from the bot you selected when creating your API key.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Troubleshooting */}
      <Card className="p-6 bg-white border border-gray-200/50 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Troubleshooting</h2>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-start gap-3">
            <div className="font-medium text-gray-900 min-w-[130px] text-xs">Not responding?</div>
            <div className="text-xs text-gray-600">Enable MessageContent intent • Check SERVICE_URL • Verify permissions</div>
          </div>
          <div className="flex items-start gap-3">
            <div className="font-medium text-gray-900 min-w-[130px] text-xs">Personality missing?</div>
            <div className="text-xs text-gray-600">Ensure API key is bound to the correct bot • Add personality in dashboard</div>
          </div>
          <div className="flex items-start gap-3">
            <div className="font-medium text-gray-900 min-w-[130px] text-xs">Commands failing?</div>
            <div className="text-xs text-gray-600">Match registry keys • Check handler.execute • Verify Discord permissions</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
