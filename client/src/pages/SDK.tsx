import APIKeysPanel from "@/components/APIKeysPanel";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SparklesIcon, BotIcon, CodeIcon, KeyIcon, RocketIcon, InfoIcon, CheckCircleIcon, CopyIcon, AlertCircleIcon, ZapIcon } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const AI_CLI_SNIPPET = `# 1) Install zero-code runtime\nnpm i @abdarrahmanabdelnasir/commandless-discord\n\n# 2) Run with environment variables (no index.js needed)\nBOT_TOKEN=... \\\nCOMMANDLESS_API_KEY=... \\\nCOMMANDLESS_SERVICE_URL=... \\\nBOT_ID=... \\\nnpx commandless-discord`;

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

      {/* Step-by-step Guide */}
      <Card className="p-6 md:p-8 border border-gray-200/50 shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Setup</h2>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-700 font-medium text-sm">1</div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-gray-900 mb-2">Install the AI runtime (no index.js)</h3>
              <p className="text-sm text-gray-600 mb-3">Install the zero‑code runtime package:</p>
              <div className="bg-gray-800 text-gray-100 p-4 rounded-lg font-mono text-sm relative">
                <code>npm i @abdarrahmanabdelnasir/commandless-discord</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText('npm i @abdarrahmanabdelnasir/commandless-discord');
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
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-700 font-medium text-sm">2</div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-gray-900 mb-2">Generate Your API Key</h3>
              <p className="text-sm text-gray-600 mb-3">Scroll down to the API Keys section and click "New Key". Copy the full key (you'll only see it once).</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-700 font-medium text-sm">3</div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-gray-900 mb-2">Set Environment Variables</h3>
              <p className="text-sm text-gray-600 mb-3">Create a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code> file:</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <code className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">BOT_TOKEN</code>
                  <span className="text-xs text-gray-600">Discord bot token</span>
                </div>
                <div className="flex items-start gap-2">
                  <code className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">COMMANDLESS_API_KEY</code>
                  <span className="text-xs text-gray-600">From step 2 (ck_xxxxx:cs_xxxxx)</span>
                </div>
                <div className="flex items-start gap-2">
                  <code className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">COMMANDLESS_SERVICE_URL</code>
                  <span className="text-xs text-gray-600">Your backend URL</span>
                </div>
                <div className="flex items-start gap-2">
                  <code className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">BOT_ID</code>
                  <span className="text-xs text-gray-600">Required: link persona/config to this bot</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-700 font-medium text-sm">4</div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-gray-900 mb-2">Choose Your Integration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div className="border border-gray-200 rounded-lg p-4 bg-white hover:border-indigo-300 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <SparklesIcon className="h-5 w-5 text-indigo-600" />
                    <div className="font-medium text-gray-900">AI-Only (CLI)</div>
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed">
                    Conversational AI replies only. No command execution. Minimal setup.
                  </div>
                  <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 mt-2 text-xs">Recommended</Badge>
                </div>
                <div className="border border-gray-200 rounded-lg p-4 bg-white hover:border-purple-300 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <CodeIcon className="h-5 w-5 text-purple-600" />
                    <div className="font-medium text-gray-900">Command Execution (coming soon)</div>
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed">
                    We’ll add routing to your handlers after initial AI‑only release.
                  </div>
                  <Badge variant="outline" className="mt-2 text-xs">Planned</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Code Templates */}
      <Card className="overflow-hidden border border-gray-200/50 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Templates</h2>
          <p className="text-sm text-gray-600 mt-1">Use the zero‑code CLI now. Command execution is coming soon.</p>
        </div>
        <div className="p-6">
          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <SparklesIcon className="h-4 w-4" />
                AI-Only (CLI)
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <CodeIcon className="h-4 w-4" />
                Command Execution (coming soon)
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="ai" className="space-y-3">
              <p className="text-sm text-gray-600">AI-powered conversational replies with a no-code CLI. No local command execution.</p>
              <div className="relative">
                <pre className="overflow-auto bg-gray-800 text-gray-100 p-4 rounded-lg text-xs leading-relaxed max-h-96 border border-gray-700/50">
                  <code>{AI_CLI_SNIPPET}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-3 right-3 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => copyToClipboard(AI_CLI_SNIPPET, false)}
                >
                  {copiedAI ? <CheckCircleIcon className="h-4 w-4 mr-1" /> : <CopyIcon className="h-4 w-4 mr-1" />}
                  {copiedAI ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="advanced" className="space-y-3">
              <div className="bg-amber-50/50 border border-amber-200/50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircleIcon className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-gray-700">
                    <strong className="font-medium">Coming soon:</strong> Command execution routed to your handlers. Today we ship AI‑only via the CLI above.
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      {/* API Keys Management */}
      <div id="api-keys-section">
        <APIKeysPanel />
      </div>

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
            <div className="text-xs text-gray-600">Set BOT_ID • Match API key to bot owner • Add personality in dashboard</div>
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


