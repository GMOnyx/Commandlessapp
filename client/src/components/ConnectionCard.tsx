import { Link } from "wouter";
import { Bot } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { SiDiscord, SiTelegram } from "react-icons/si";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { 
  AlertDialog, 
  AlertDialogContent, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyIcon, CheckIcon } from "lucide-react";
import BotCreationDialog from "@/components/BotCreationDialog";

interface ConnectionCardProps {
  bot: Bot;
  isNewCard?: boolean;
}

export default function ConnectionCard({ bot, isNewCard = false }: ConnectionCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showClientCodeDialog, setShowClientCodeDialog] = useState(false);
  const [clientCode, setClientCode] = useState("");
  const [instructions, setInstructions] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    troubleshooting?: string[];
    details?: string;
  }>({
    message: "",
    troubleshooting: [],
    details: ""
  });
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(clientCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Discord bot client code copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please manually copy the code.",
        variant: "destructive",
      });
    }
  };
  
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/bots`, { 
        method: 'PUT',
        body: JSON.stringify({ id: bot.id, action: 'connect' })
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      
      // Check if this is a Discord bot with client code
      if (data.clientCode && data.instructions) {
        setClientCode(data.clientCode);
        setInstructions(data.instructions);
        setShowClientCodeDialog(true);
      } else {
        toast({
          title: "Success",
          description: `${bot.botName} has been connected.`,
        });
      }
    },
    onError: (error: any) => {
      // Try to parse the error response for detailed information
      let errorMessage = `Failed to connect ${bot.botName}`;
      let troubleshooting: string[] | undefined;
      let details: string | undefined;
      
      if (error instanceof Error) {
        try {
          // Check if the error has structured data
          const errorText = error.message;
          
          // Extract JSON from error message if present
          const jsonMatch = errorText.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.message || errorMessage;
            troubleshooting = errorData.troubleshooting;
            details = errorData.details;
          } else {
            // Handle cases where the error message contains the structured response
            if (errorText.includes("500:") || errorText.includes("400:")) {
              const responseMatch = errorText.match(/(?:500|400):\s*(.+)/);
              if (responseMatch) {
                try {
                  const responseData = JSON.parse(responseMatch[1]);
                  errorMessage = responseData.message || errorMessage;
                  troubleshooting = responseData.troubleshooting;
                  details = responseData.details;
                } catch {
                  errorMessage = responseMatch[1];
                }
              }
            } else {
              errorMessage = errorText;
            }
          }
        } catch {
          errorMessage = error.message;
        }
      }
      
      // Show detailed error information if available
      if (troubleshooting && troubleshooting.length > 0) {
        setErrorDetails({
          message: errorMessage,
          troubleshooting,
          details
        });
        setShowErrorDialog(true);
      } else {
      toast({
        title: "Error",
          description: errorMessage,
        variant: "destructive",
      });
      }
    },
  });
  
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/bots`, { 
        method: 'PUT',
        body: JSON.stringify({ id: bot.id, action: 'disconnect' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({
        title: "Success",
        description: `${bot.botName} has been disconnected.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to disconnect ${bot.botName}. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    },
  });
  
  const syncCommandsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/bots`, { 
        method: 'PUT',
        body: JSON.stringify({ id: bot.id, action: 'sync-commands' })
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mappings"] });
      toast({
        title: "Commands Synced",
        description: `Found ${data.commandsFound} commands, created ${data.commandsCreated} new mappings${data.commandsSkipped > 0 ? `, skipped ${data.commandsSkipped} existing` : ''}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: `Failed to sync commands for ${bot.botName}. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    },
  });
  
  if (isNewCard) {
    return (
      <>
        <Card className="overflow-hidden border-2 border-dashed border-gray-300">
          <CardContent className="p-5 flex justify-center items-center h-full">
            <button 
              type="button" 
              className="relative block w-full py-6 text-center"
              onClick={() => setShowCreateDialog(true)}
            >
              <div className="text-gray-400 text-2xl mb-2">+</div>
              <span className="block text-sm font-medium text-gray-900">Connect new bot</span>
            </button>
          </CardContent>
        </Card>
        
        <BotCreationDialog 
          open={showCreateDialog} 
          onOpenChange={setShowCreateDialog} 
        />
      </>
    );
  }
  
  const getPlatformIcon = () => {
    if (bot.platformType === "discord") {
      return <SiDiscord className="text-white text-xl" />;
    } else if (bot.platformType === "telegram") {
      return <SiTelegram className="text-white text-xl" />;
    }
    return null;
  };
  
  const getPlatformColor = () => {
    if (bot.platformType === "discord") {
      return "bg-blue-500";
    } else if (bot.platformType === "telegram") {
      return "bg-blue-400";
    }
    return "bg-gray-500";
  };
  
  return (
    <>
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center">
          <div className={cn("flex-shrink-0 rounded-md p-3", getPlatformColor())}>
            {getPlatformIcon()}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {bot.platformType === "discord" ? "Discord" : "Telegram"}
              </dt>
              <dd>
                <div className="flex items-center">
                  <div className="text-lg font-medium text-gray-900">{bot.botName}</div>
                  <span className="ml-2 flex-shrink-0">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      bot.isConnected 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    )}>
                      <div className={cn(
                        "h-2 w-2 mr-1 rounded-full",
                        bot.isConnected 
                          ? "bg-green-400 animate-pulse" 
                          : "bg-red-400"
                      )}></div>
                      {bot.isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </span>
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-gray-50 px-5 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between w-full">
          <div className="text-sm">
            {bot.isConnected ? (
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="font-medium text-primary hover:text-primary-600 focus:outline-none"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect bot"}
              </button>
            ) : (
              <button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="font-medium text-primary hover:text-primary-600 focus:outline-none"
              >
                {connectMutation.isPending ? "Connecting..." : "Connect bot"}
              </button>
            )}
          </div>
          
          {bot.isConnected && bot.platformType === "discord" && (
            <div className="text-sm">
              <button
                onClick={() => syncCommandsMutation.mutate()}
                disabled={syncCommandsMutation.isPending}
                className="font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
              >
                {syncCommandsMutation.isPending ? "Syncing..." : "Sync Commands"}
              </button>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
      
      {/* Client Code Dialog */}
      <Dialog open={showClientCodeDialog} onOpenChange={setShowClientCodeDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiDiscord className="text-blue-500" />
              Discord Bot Client Code - {bot.botName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">🎉 Bot Connected Successfully!</h4>
              <p className="text-green-700 text-sm">
                Your Discord bot has been validated and is ready to use. Follow the instructions below to start the bot client.
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">📋 Instructions:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                {instructions.map((instruction, index) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ol>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">🤖 Discord Bot Client Code:</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="flex items-center gap-1"
                >
                  {copied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
                  {copied ? "Copied!" : "Copy Code"}
                </Button>
              </div>
              <Textarea
                value={clientCode}
                readOnly
                className="font-mono text-xs h-96 resize-none"
                placeholder="Client code will appear here..."
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">💡 Quick Start:</h4>
              <div className="text-blue-700 text-sm space-y-1">
                <p>1. Save the code above to a file called <code className="bg-blue-100 px-1 rounded">discord-bot.js</code></p>
                <p>2. Run: <code className="bg-blue-100 px-1 rounded">npm install discord.js node-fetch</code></p>
                <p>3. Run: <code className="bg-blue-100 px-1 rounded">node discord-bot.js</code></p>
                <p>4. Test by mentioning your bot in Discord: <code className="bg-blue-100 px-1 rounded">@{bot.botName} hello</code></p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowClientCodeDialog(false)}>
              Got it, let's go!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Connection Failed</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{errorDetails.message}</p>
                
                {errorDetails.troubleshooting && (
                  <div>
                    <p className="font-medium text-sm">Troubleshooting steps:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 mt-1">
                      {errorDetails.troubleshooting.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {errorDetails.details && (
                  <div>
                    <p className="font-medium text-sm">Technical details:</p>
                    <p className="text-xs text-gray-600 mt-1 font-mono bg-gray-100 p-2 rounded">
                      {errorDetails.details}
                    </p>
                  </div>
                )}
                
                <div className="text-sm text-blue-600">
                  <p className="font-medium">Need help?</p>
                  <p>Visit the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="underline">Discord Developer Portal</a> to check your bot settings.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowErrorDialog(false)}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
