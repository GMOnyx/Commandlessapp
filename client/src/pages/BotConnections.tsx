import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bot } from "@shared/schema";
import ConnectionCard from "@/components/ConnectionCard";
import BotCreationDialog from "@/components/BotCreationDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlusIcon, BotIcon, BookOpenIcon, InfoIcon } from "lucide-react";

export default function BotConnections() {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Fetch bots
  const { 
    data: bots, 
    isLoading, 
    error 
  } = useQuery<Bot[]>({
    queryKey: ["/api/bots"],
  });
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Bot Connections</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          New Bot Connection
        </Button>
      </div>
      
      <Alert className="mb-6">
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span>
              <strong>Need help making your bot functional?</strong> Creating a bot here is just the first step. 
              You'll need to set up the Discord bot client to connect to our AI processing system.
            </span>
            <Link href="/setup">
              <Button variant="outline" size="sm" className="ml-4">
                <BookOpenIcon className="h-3 w-3 mr-1" />
                Setup Guide
              </Button>
            </Link>
          </div>
        </AlertDescription>
      </Alert>
      
      <BotCreationDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
      />
      
      {isLoading ? (
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
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <BotIcon className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load bot connections</h3>
          <p className="text-gray-500">Please try refreshing the page or check your connection.</p>
        </div>
      ) : bots && bots.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <ConnectionCard key={bot.id} bot={bot} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <BotIcon className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bot connections yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Connect your Discord bots and other platforms to start creating intelligent command mappings.
          </p>
          <Button onClick={() => setDialogOpen(true)} className="inline-flex items-center">
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Create your first bot connection
          </Button>
        </div>
      )}
    </div>
  );
}
