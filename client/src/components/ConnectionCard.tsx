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
      await apiRequest(`/api/bots?action=connect`, { 
        method: "POST",
        body: JSON.stringify({ botId: bot.id })
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
      await apiRequest(`/api/bots?action=disconnect`, {
        method: "POST",
        body: JSON.stringify({ botId: bot.id }),
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
