import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, CommandMapping } from "@shared/schema";
import ConnectionCard from "@/components/ConnectionCard";
import CommandMappingItem from "@/components/CommandMappingItem";
import ActivityFeed from "@/components/ActivityFeed";
import CommandMappingBuilder from "@/components/CommandMappingBuilder";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
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
  
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>
      
      {/* Bot Connections */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Bot Connections</h2>
        {isLoadingBots ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <Skeleton className="h-12 w-12 rounded-md" />
                    <div className="ml-5 w-0 flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-6 w-48" />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-200">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bots && bots.map((bot) => (
              <ConnectionCard key={bot.id} bot={bot} />
            ))}
            <ConnectionCard isNewCard={true} bot={{} as Bot} />
          </div>
        )}
      </div>
      
      {/* Active Command Mappings */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Active Command Mappings</h2>
          <Button onClick={toggleBuilder}>
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
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
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
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {mappings.map((mapping) => (
                <CommandMappingItem key={mapping.id} mapping={mapping} bots={bots || []} />
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md p-6 text-center text-gray-500">
            No command mappings yet. Click "New Mapping" to create one.
          </div>
        )}
      </div>
      
      {/* Recent Activity */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <ActivityFeed />
      </div>
    </div>
  );
}
