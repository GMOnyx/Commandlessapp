import { Link } from "wouter";
import { Bot } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { SiDiscord, SiTelegram } from "react-icons/si";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ConnectionCardProps {
  bot: Bot;
  isNewCard?: boolean;
}

export default function ConnectionCard({ bot, isNewCard = false }: ConnectionCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const connectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/bots/${bot.id}/connect`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({
        title: "Success",
        description: `${bot.botName} has been connected.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to connect ${bot.botName}. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    },
  });
  
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/bots/${bot.id}/disconnect`);
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
      <Card className="overflow-hidden border-2 border-dashed border-gray-300">
        <CardContent className="p-5 flex justify-center items-center h-full">
          <button 
            type="button" 
            className="relative block w-full py-6 text-center"
            onClick={() => {
              // Handle showing the add new bot dialog
              // This would be implemented with a modal component
              toast({
                title: "Coming Soon",
                description: "Adding new bots will be available soon!",
              });
            }}
          >
            <div className="text-gray-400 text-2xl mb-2">+</div>
            <span className="block text-sm font-medium text-gray-900">Connect a new platform</span>
          </button>
        </CardContent>
      </Card>
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
  );
}
