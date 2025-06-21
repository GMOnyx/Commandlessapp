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
  
  const connectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/bots`, {
        method: "PUT",
        body: JSON.stringify({ action: "connect", botId: bot.id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({
        title: "Success",
        description: `${bot.botName} has been connected.`,
      });
    },
    onError: (error: any) => {
      // Try to parse the error response for detailed information
      let errorMessage = "Failed to connect bot";
      let troubleshooting: string[] = [];
      let details = "";
      
      try {
        if (error instanceof Error) {
          const errorData = JSON.parse(error.message);
          errorMessage = errorData.error || errorMessage;
          troubleshooting = errorData.troubleshooting || [];
          details = errorData.details || "";
        }
      } catch {
        // If parsing fails, use the error message directly
        errorMessage = error instanceof Error ? error.message : errorMessage;
      }
      
      setErrorDetails({
        message: errorMessage,
        troubleshooting,
        details
      });
      setShowErrorDialog(true);
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
      </CardFooter>
    </Card>

    {/* Error Dialog */}
    <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Connection Failed</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>{errorDetails.message}</p>
            {errorDetails.details && (
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">{errorDetails.details}</p>
              </div>
            )}
            {errorDetails.troubleshooting && errorDetails.troubleshooting.length > 0 && (
              <div>
                <p className="font-medium text-sm mb-2">Troubleshooting steps:</p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  {errorDetails.troubleshooting.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setShowErrorDialog(false)}>
            OK
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
