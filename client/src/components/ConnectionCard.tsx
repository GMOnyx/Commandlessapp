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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  CopyIcon, 
  CheckIcon, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  XCircle 
} from "lucide-react";
import BotCreationDialog from "@/components/BotCreationDialog";

interface ConnectionCardProps {
  bot: Bot;
  isNewCard?: boolean;
}

export default function ConnectionCard({ bot, isNewCard = false }: ConnectionCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [connectionDialogTitle, setConnectionDialogTitle] = useState('');
  const [connectionDialogContent, setConnectionDialogContent] = useState<React.ReactNode>(null);
  
  // Loading states
  const [connectLoading, setConnectLoading] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    botName: bot.botName || '',
    token: '',
    personalityContext: bot.personalityContext || ''
  });
  
  const handleConnect = async () => {
    if (!bot.id) return;
    
    setConnectLoading(true);
    try {
      const response = await apiRequest(`/api/bots/${bot.id}/connect`, {
        method: 'POST'
      });

      // Handle different connection scenarios
      if (response.autoStarted) {
        setConnectionDialogTitle('🎉 Bot Connected & Started!');
        setConnectionDialogContent(
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Your Discord bot is now live and responding!</span>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Method:</strong> {response.startupMethod}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {response.message}
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
      } else {
        setConnectionDialogTitle('✅ Bot Connected');
        setConnectionDialogContent(
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>{response.message || 'Bot connected successfully!'}</span>
            </div>
          </div>
        );
      }
      
      setShowConnectionDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionDialogTitle('❌ Connection Failed');
      setConnectionDialogContent(
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
      setShowConnectionDialog(true);
    } finally {
      setConnectLoading(false);
    }
  };
  
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/bots/${bot.id}/disconnect`, { 
        method: 'POST'
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
  
  const editMutation = useMutation({
    mutationFn: async (data: { botName: string; token?: string; personalityContext?: string }) => {
      await apiRequest(`/api/bots/${bot.id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      setShowEditDialog(false);
      setEditForm({ botName: '', token: '', personalityContext: '' });
      toast({
        title: "Success",
        description: `${bot.botName} has been updated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update ${bot.botName}. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/bots/${bot.id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      setShowDeleteDialog(false);
      toast({
        title: "Success",
        description: `${bot.botName} has been deleted.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete ${bot.botName}. ${error instanceof Error ? error.message : ''}`,
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

  const handleEdit = () => {
    setEditForm({
      botName: bot.botName || '',
      token: '',
      personalityContext: bot.personalityContext || ''
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = () => {
    editMutation.mutate({
      botName: editForm.botName,
      token: editForm.token || undefined,
      personalityContext: editForm.personalityContext
    });
  };
  
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
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1">
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
            
            {/* Three-dot menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit credentials
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete bot
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  disabled={connectLoading}
                  className="font-medium text-primary hover:text-primary-600 focus:outline-none"
                >
                  {connectLoading ? "Connecting..." : "Connect bot"}
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
      
      {/* Connection Status Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{connectionDialogTitle}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {connectionDialogContent}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowConnectionDialog(false)}>
              Got it, let's go!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Bot Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Bot Credentials</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-bot-name">Bot Name</Label>
              <Input
                id="edit-bot-name"
                value={editForm.botName}
                onChange={(e) => setEditForm(prev => ({ ...prev, botName: e.target.value }))}
                placeholder="Enter bot name"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-token">Discord Token (leave empty to keep current)</Label>
              <Input
                id="edit-token"
                type="password"
                value={editForm.token}
                onChange={(e) => setEditForm(prev => ({ ...prev, token: e.target.value }))}
                placeholder="Enter new token or leave empty"
              />
              <p className="text-xs text-gray-500 mt-1">
                Only enter a new token if you want to change it
              </p>
            </div>
            
            <div>
              <Label htmlFor="edit-personality">Personality Context</Label>
              <Textarea
                id="edit-personality"
                value={editForm.personalityContext}
                onChange={(e) => setEditForm(prev => ({ ...prev, personalityContext: e.target.value }))}
                placeholder="Describe your bot's personality..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditSubmit}
              disabled={editMutation.isPending || !editForm.botName.trim()}
            >
              {editMutation.isPending ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{bot.botName}</strong>? This action cannot be undone.
              All command mappings associated with this bot will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Bot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 