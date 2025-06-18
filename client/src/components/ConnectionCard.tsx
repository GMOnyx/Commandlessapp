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
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogContent, setDialogContent] = useState<React.ReactNode>(null);
  
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
  
  const handleConnect = async () => {
    if (!bot.id) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/bots', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          id: bot.id,
          action: 'connect'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to connect bot');
      }

      const result = await response.json();
      
      // Handle different connection scenarios
      if (result.autoStarted) {
        // Bot was automatically started
        setShowDialog(true);
        setDialogTitle('🎉 Bot Connected & Started!');
        setDialogContent(
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Your Discord bot is now live and responding!</span>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Startup Method:</strong> {result.startupMethod}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {result.message}
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">Test your bot:</p>
              <div className="text-sm text-blue-700 mt-1 font-mono">
                @{bot.botName} hello<br/>
                @{bot.botName} what can you do?
              </div>
            </div>
          </div>
        );
      } else if (result.requiresManualStart && result.clientCode) {
        // Bot connected but needs manual client code execution
        setShowDialog(true);
        setDialogTitle('🤖 Bot Connected - Manual Start Required');
        setDialogContent(
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              <span>Bot connected! Run the client code to start responding.</span>
            </div>
            
            {result.message && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-sm text-yellow-800">{result.message}</p>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Instructions:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                {result.instructions?.map((instruction: string, index: number) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ol>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Discord Client Code:</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(result.clientCode);
                    // Could add a toast notification here
                  }}
                  className="flex items-center space-x-1"
                >
                  <CopyIcon className="h-4 w-4" />
                  <span>Copy</span>
                </Button>
              </div>
              <pre className="bg-gray-100 p-3 rounded-lg text-xs overflow-x-auto max-h-40">
                <code>{result.clientCode}</code>
              </pre>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">After running the code, test your bot:</p>
              <div className="text-sm text-blue-700 mt-1 font-mono">
                @{bot.botName} hello<br/>
                @{bot.botName} what can you do?
              </div>
            </div>
          </div>
        );
      } else {
        // Regular connection (non-Discord or other platforms)
        setShowDialog(true);
        setDialogTitle('✅ Bot Connected');
        setDialogContent(
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>{result.message || 'Bot connected successfully!'}</span>
            </div>
          </div>
        );
      }

      // Refresh the bot list to show updated status
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      
    } catch (error) {
      console.error('Connection error:', error);
      setShowDialog(true);
      setDialogTitle('❌ Connection Failed');
      setDialogContent(
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span>Failed to connect bot</span>
          </div>
          <p className="text-sm text-gray-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      );
    } finally {
      setLoading(false);
    }
  };
  
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
      
      // Handle different connection scenarios
      if (data.autoStarted) {
        // Bot was automatically started
        toast({
          title: "🎉 Bot Connected & Started!",
          description: `${bot.botName} is now live and responding using ${data.startupMethod}!`,
        });
      } else if (data.requiresManualStart && data.clientCode && data.instructions) {
        // Bot connected but needs manual client code execution
        setClientCode(data.clientCode);
        setInstructions(data.instructions);
        setShowClientCodeDialog(true);
        toast({
          title: "Bot Connected",
          description: `${bot.botName} connected! Please run the client code to start responding.`,
        });
      } else if (data.clientCode && data.instructions) {
        // Legacy Discord bot connection (fallback)
        setClientCode(data.clientCode);
        setInstructions(data.instructions);
        setShowClientCodeDialog(true);
      } else {
        // Regular connection (non-Discord or other platforms)
        toast({
          title: "Success",
          description: data.message || `${bot.botName} has been connected.`,
        });
      }
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
                onClick={handleConnect}
                disabled={loading}
                className="font-medium text-primary hover:text-primary-600 focus:outline-none"
              >
                {loading ? "Connecting..." : "Connect bot"}
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
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {dialogContent}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowDialog(false)}>
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
