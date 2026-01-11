import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink } from "lucide-react";
import { Bot } from "@shared/schema";

interface SDKLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApiKeyRow {
  keyId: string;
  botId?: number | null;
}

export default function SDKLinkDialog({ open, onOpenChange }: SDKLinkDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [botName, setBotName] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState("");

  // Fetch API keys
  const { data: keys } = useQuery<ApiKeyRow[]>({ 
    queryKey: ["/api/keys"],
    enabled: open,
  });

  // Fetch bots
  const { data: bots } = useQuery<Bot[]>({ 
    queryKey: ["/api/bots"],
    enabled: open,
  });

  // Create SDK bot mutation
  const createSDKBot = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/bots", {
        method: "POST",
        body: JSON.stringify({
          botName: botName || "SDK Bot",
          platformType: "discord",
          token: "", // Empty token for SDK bots
          clientId: "",
        }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({
        title: "SDK Bot Created!",
        description: `Bot ID: ${data.id}. Set BOT_ID=${data.id} in your environment variables.`,
        duration: 10000,
      });
      setBotName("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create SDK bot: ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    },
  });

  const handleCopySetup = () => {
    const setupCode = `# In your bot project's .env file:
BOT_TOKEN=your_discord_bot_token
COMMANDLESS_API_KEY=${selectedKeyId || 'your_api_key'}
BOT_ID=${bots?.[0]?.id || 'your_bot_id'}

# Install SDK
npm install discord.js @abdarrahmanabdelnasir/relay-node

# Run with: npx commandless-discord
# Or use the examples in /examples directory`;

    navigator.clipboard.writeText(setupCode);
    toast({
      title: "Copied!",
      description: "Setup instructions copied to clipboard",
      duration: 3000,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link SDK Bot</DialogTitle>
          <DialogDescription>
            Create a bot entry for your SDK-powered Discord bot
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Create bot entry */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold">
                1
              </div>
              <h3 className="font-semibold">Create Bot Entry</h3>
            </div>
            <div className="ml-8 space-y-3">
              <div>
                <Label>Bot Name</Label>
                <Input
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="My Bot Name"
                />
              </div>
              <Button 
                onClick={() => createSDKBot.mutate()}
                disabled={!botName || createSDKBot.isPending}
              >
                {createSDKBot.isPending ? "Creating..." : "Create Bot Entry"}
              </Button>
            </div>
          </div>

          {/* Step 2: Configure SDK */}
          {bots && bots.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold">
                  2
                </div>
                <h3 className="font-semibold">Configure Your Bot Code</h3>
              </div>
              <div className="ml-8 space-y-3">
                <p className="text-sm text-gray-600">
                  Add these environment variables to your bot:
                </p>
                <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm space-y-1">
                  <div>BOT_TOKEN=your_discord_bot_token</div>
                  <div>COMMANDLESS_API_KEY={keys?.[0]?.keyId || 'get_from_api_keys_page'}</div>
                  <div>BOT_ID={bots[bots.length - 1]?.id}</div>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopySetup}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Setup Code
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Documentation */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold">
                3
              </div>
              <h3 className="font-semibold">Run Your Bot</h3>
            </div>
            <div className="ml-8 space-y-3">
              <p className="text-sm text-gray-600">
                Your bot will automatically register when it starts:
              </p>
              <div className="bg-gray-50 border rounded-lg p-3 font-mono text-sm">
                npx commandless-discord
              </div>
              <Button variant="link" size="sm" asChild>
                <a href="/sdk" className="flex items-center">
                  View Full Documentation
                  <ExternalLink className="h-4 w-4 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

