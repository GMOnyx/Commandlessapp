import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, CommandMapping } from "@shared/schema";
import CommandMappingItem from "@/components/CommandMappingItem";
import CommandMappingBuilder from "@/components/CommandMappingBuilder";
import { Button } from "@/components/ui/button";
import { PlusIcon, SearchIcon, BotIcon, WandIcon, SparklesIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";

export default function CommandMappings() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Fetch bots
  const { 
    data: bots, 
    isLoading: isLoadingBots 
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
  
  // Filter mappings by search term and status
  const filteredMappings = mappings?.filter((mapping) => {
    const matchesSearch = searchTerm 
      ? mapping.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.naturalLanguagePattern.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
      
    const matchesStatus = statusFilter === "all" ? true : mapping.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Command Mappings</h1>
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
      
      {/* Search and Filters */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="search"
              placeholder="Search mappings..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Tabs 
            defaultValue="all" 
            className="w-full sm:w-auto"
            onValueChange={(value) => setStatusFilter(value)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      {/* Mappings List */}
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
      ) : filteredMappings && filteredMappings.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredMappings.map((mapping) => (
              <CommandMappingItem key={mapping.id} mapping={mapping} bots={bots || []} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-8 py-8 text-center">
          <div className="flex flex-col items-center justify-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 mb-4">
                {searchTerm || statusFilter !== "all" ? (
                  <SearchIcon className="h-6 w-6 text-purple-600" />
                ) : (
                  <WandIcon className="h-6 w-6 text-purple-600" />
                )}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {searchTerm || statusFilter !== "all" 
                  ? "No mappings found" 
                  : "Ready to create your first command?"}
              </h3>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search terms or filters to find the command mappings you're looking for."
                  : "Connect a bot to automatically discover and create command mappings, or manually create your first command mapping."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
