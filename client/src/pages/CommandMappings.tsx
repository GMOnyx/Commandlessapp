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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
  
  // Parse main command and facet from commandOutput
  const parseMainFacet = (commandOutput?: string): { main: string; facet?: string } => {
    if (!commandOutput) return { main: "unknown" };
    const tokens = commandOutput.trim().split(/\s+/);
    const first = tokens[0] || "";
    const main = first.startsWith("/") ? first.slice(1) : first;
    const possible = tokens[1] || "";
    const facet = possible && !possible.includes(":") && !possible.startsWith("{") ? possible : undefined;
    return { main: main || "unknown", facet };
  };

  // Group filtered mappings by main command
  const grouped = (() => {
    const map = new Map<string, { main: string; items: CommandMapping[] }>();
    (filteredMappings || []).forEach((m) => {
      const { main } = parseMainFacet(m.commandOutput);
      if (!map.has(main)) map.set(main, { main, items: [] });
      map.get(main)!.items.push(m);
    });
    return Array.from(map.values()).sort((a, b) => a.main.localeCompare(b.main));
  })();

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
      
      {/* Mappings List (Grouped by main command) */}
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
      ) : grouped && grouped.length > 0 ? (
        <Accordion type="multiple" className="bg-white shadow overflow-hidden sm:rounded-md">
          {grouped.map((group) => {
            // Sort so base (no facet) first, then common facet order, then alphabetical
            const order = ["add", "remove", "temp"];
            const items = group.items.slice().sort((a, b) => {
              const fa = parseMainFacet(a.commandOutput).facet;
              const fb = parseMainFacet(b.commandOutput).facet;
              if (!fa && fb) return -1;
              if (fa && !fb) return 1;
              const ia = fa ? order.indexOf(fa) : -1;
              const ib = fb ? order.indexOf(fb) : -1;
              if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
              return (fa || a.name).localeCompare(fb || b.name);
            });
            const totalUsage = items.reduce((sum, m) => sum + (m.usageCount || 0), 0);
            const base = items.find((m) => !parseMainFacet(m.commandOutput).facet);
            const subtitle = base?.naturalLanguagePattern || items[0]?.naturalLanguagePattern || "";
            return (
              <AccordionItem key={group.main} value={group.main}>
                <AccordionTrigger className="px-4 py-4 sm:px-6 hover:no-underline">
                  <div className="flex w-full items-start justify-between gap-4">
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{group.main}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{subtitle}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        {items.length} facet{items.length !== 1 ? "s" : ""}
                      </span>
                      <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                        {totalUsage} uses
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="divide-y divide-gray-200">
                    {items.map((m) => (
                      <CommandMappingItem key={m.id} mapping={m} bots={bots || []} />
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
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
