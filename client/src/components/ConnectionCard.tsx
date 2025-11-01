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
  AlertDialogAction,
  AlertDialogCancel
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import BotCreationDialog from "@/components/BotCreationDialog";

// Response type interfaces
interface ConnectionResponse {
  autoStarted?: boolean;
  deploymentRequired?: boolean;
  requiresManualStart?: boolean;
  status?: string;
  message?: string;
  troubleshooting?: string[];
  startupMethod?: string;
}

interface SyncCommandsResponse {
  success: boolean;
  commandCount?: number;
  createdMappings?: number;
  discoveredCommands?: any[];
  message?: string;
}

interface ConnectionCardProps {
  bot: Bot;
  isNewCard?: boolean;
}

export default function ConnectionCard({ bot, isNewCard = false }: ConnectionCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isSdkBot = !(bot as any).token; // SDK-linked bots don't store tokens
  const requestSdkSync = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/relay/commands/request-sync', {
        method: 'POST',
        body: JSON.stringify({ botId: bot.id })
      });
    },
    onSuccess: () => {
      toast({ title: 'Sync requested', description: 'Your SDK bot will auto-sync on next heartbeat (≤25s).' });
    },
    onError: (e: any) => {
      toast({ title: 'Sync request failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
  });
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    troubleshooting?: string[];
    details?: string;
  }>({
    message: "",
    troubleshooting: [],
    details: ""
  });
  
  const connectMutation = useMutation<ConnectionResponse>({
    mutationFn: async (): Promise<ConnectionResponse> => {
      return await apiRequest(`/api/bots`, {
        method: "PUT",
        body: JSON.stringify({ action: "connect", botId: bot.id }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      
      // Safely check for data properties with fallbacks
      if (data && data.autoStarted) {
        toast({
          title: "Success",
          description: `🎉 ${bot.botName} is now live and responding!`,
        });
      } else if (data && data.deploymentRequired) {
        toast({
          title: "Manual Deployment Required",
          description: `⚠️ ${bot.botName} is configured but needs manual deployment to respond to messages.`,
          variant: "destructive",
        });
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
        method: "PUT", 
        body: JSON.stringify({ action: "disconnect", botId: bot.id }),
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/bots/${bot.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({
        title: "Success",
        description: `${bot.botName} has been deleted successfully.`,
      });
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete ${bot.botName}. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    },
  });

  const syncCommandsMutation = useMutation<SyncCommandsResponse>({
    mutationFn: async (): Promise<SyncCommandsResponse> => {
      return await apiRequest(`/api/bots`, {
        method: "PUT",
        body: JSON.stringify({ 
          action: "sync-commands", 
          botId: bot.id,
          forceRefresh: true 
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({
        title: "Commands Synced",
        description: `Successfully synced ${data.createdMappings || 0} commands for ${bot.botName}`,
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
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="block text-sm font-medium text-gray-900">Connect or link a bot</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setShowCreateDialog(true)}>Connect new bot</Button>
              <Button variant="outline" onClick={async () => {
                const clientId = window.prompt('Enter Discord Client ID for your SDK bot:');
                if (!clientId) return;
                
                const botName = window.prompt('Enter a name for this bot (optional):') || 'SDK Bot';
                
                try {
                  // Create bot without token (SDK bot)
                  const botData = await apiRequest('/api/bots', {
                    method: 'POST',
                    body: JSON.stringify({
                      botName,
                      platformType: 'discord',
                      clientId,
                      token: '' // Empty token indicates SDK bot
                    })
                  });
                  
                  if (botData.id) {
                    toast({
                      title: "SDK Bot Created!",
                      description: `Bot ID: ${botData.id}. Save this - you'll need it for BOT_ID env var!`,
                      duration: 10000,
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
                    window.location.reload();
                  }
                } catch (e: any) {
                  alert(`Failed to create SDK bot: ${e?.message || 'Unknown error'}`);
                }
              }}>Link SDK bot</Button>
            </div>
          </CardContent>
        </Card>
        <BotCreationDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
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
                <div className="space-y-1">
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      Bot ID: {bot.id}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(String(bot.id));
                        toast({
                          title: "Copied!",
                          description: "Bot ID copied to clipboard",
                          duration: 2000,
                        });
                      }}
                      className="text-xs text-primary hover:text-primary-600 focus:outline-none"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </dd>
            </dl>
          </div>
          <div className="ml-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          
          {/* Sync Commands Button - only show for Discord bots */}
          {bot.platformType === "discord" && !isSdkBot && (
            <button
              onClick={() => syncCommandsMutation.mutate()}
              disabled={syncCommandsMutation.isPending}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncCommandsMutation.isPending ? "Syncing..." : "Sync Commands"}
            </button>
          )}
          {bot.platformType === "discord" && isSdkBot && (
            <button
              onClick={() => requestSdkSync.mutate()}
              disabled={requestSdkSync.isPending}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestSdkSync.isPending ? 'Requesting…' : 'Request Sync'}
            </button>
          )}
        </div>
      </CardFooter>
    </Card>

    {/* Error Dialog */}
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

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Bot Connection</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{bot.botName}"? This will also delete all associated command mappings. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Edit Dialog */}
    <BotCreationDialog 
      open={showEditDialog} 
      onOpenChange={setShowEditDialog}
      editBot={bot}
    />

    </>
  );
}
