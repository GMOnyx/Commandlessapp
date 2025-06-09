import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, CommandMapping } from "@shared/schema";
import ConnectionCard from "@/components/ConnectionCard";
import CommandMappingItem from "@/components/CommandMappingItem";
import ActivityFeed from "@/components/ActivityFeed";
import CommandMappingBuilder from "@/components/CommandMappingBuilder";
import { Button } from "@/components/ui/button";
import { PlusIcon, BotIcon, CheckCircleIcon, XCircleIcon, SparklesIcon, WandIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [showBuilder, setShowBuilder] = useState(false);
  
  // Fetch bots
  const { 
    data: bots, 
    isLoading: isLoadingBots,
    error: botsError 
  } = useQuery<Bot[]>({
    queryKey: ["/api/bots"],
  });
  
  // Fetch command mappings
  const { 
    data: mappings, 
    isLoading: isLoadingMappings,
    error: mappingsError 
  } = useQuery<CommandMapping[]>({
    queryKey: ["/api/mappings"],
  });
  
  const toggleBuilder = () => {
    setShowBuilder(!showBuilder);
  };

  // Calculate bot status
  const connectedBots = bots?.filter(bot => bot.isConnected).length || 0;
  const totalBots = bots?.length || 0;
  const disconnectedBots = totalBots - connectedBots;
  
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header with Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Dashboard</h1>
        </div>
        
        {/* Live Bot Status Summary */}
        {!isLoadingBots && totalBots > 0 && (
          <div className="flex items-center gap-4 bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">{connectedBots}</span>
              </div>
              <span className="text-sm text-gray-500">connected</span>
            </div>
            {disconnectedBots > 0 && (
              <>
                <div className="w-px h-4 bg-gray-300" />
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <XCircleIcon className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">{disconnectedBots}</span>
                  </div>
                  <span className="text-sm text-gray-500">offline</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Bot Connections */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Bot Connections</h2>
          <span className="text-sm text-gray-500">
            {totalBots === 0 ? 'No bots' : `${totalBots} ${totalBots === 1 ? 'bot' : 'bots'}`}
          </span>
        </div>
        {isLoadingBots ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-100">
                <div className="p-5">
                  <div className="flex items-center">
                    <Skeleton className="h-12 w-12 rounded-md" />
                    <div className="ml-5 w-0 flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-6 w-48" />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : botsError ? (
          <div className="text-center py-4 text-red-500">
            Failed to load bot connections
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bots && bots.map((bot) => (
              <ConnectionCard key={bot.id} bot={bot} />
            ))}
            <ConnectionCard isNewCard={true} bot={{} as Bot} />
          </div>
        )}
      </div>
      
      {/* Active Command Mappings */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-medium text-gray-900">Active Command Mappings</h2>
          <Button onClick={toggleBuilder} className="bg-[#5046E4] hover:bg-[#5046E4]/90 text-white w-full sm:w-auto">
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            New Mapping
          </Button>
        </div>
        
        {showBuilder && (
          <div className="mb-6">
            <CommandMappingBuilder bots={bots || []} />
          </div>
        )}
        
        {isLoadingMappings ? (
          <div className="bg-white shadow-sm overflow-hidden sm:rounded-md border border-gray-100">
            <ul className="divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <li key={i} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="mt-2">
                    <Skeleton className="h-4 w-64" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : mappingsError ? (
          <div className="text-center py-4 text-red-500">
            Failed to load command mappings
          </div>
        ) : mappings && mappings.length > 0 ? (
          <div className="bg-white shadow-sm overflow-hidden sm:rounded-md border border-gray-100">
            <ul className="divide-y divide-gray-200">
              {mappings.map((mapping) => (
                <CommandMappingItem key={mapping.id} mapping={mapping} bots={bots || []} />
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-white shadow-sm overflow-hidden sm:rounded-md border border-gray-100">
            <div className="px-6 py-8 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 mb-4">
                <WandIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                Ready to create your first command?
              </h3>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                Connect a bot to automatically discover and create command mappings, 
                or manually create your first command mapping.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <div className="bg-white shadow-sm rounded-lg border border-gray-100">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
