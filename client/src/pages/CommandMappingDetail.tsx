import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { CommandMapping, Bot } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeftIcon, 
  MessageCircleIcon, 
  BotIcon, 
  CalendarIcon,
  TrendingUpIcon,
  EditIcon,
  LoaderIcon,
  CheckIcon,
  XIcon
} from "lucide-react";
import { SiDiscord, SiTelegram } from "react-icons/si";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

export default function CommandMappingDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    naturalLanguagePattern: "",
    commandOutput: "",
    status: "active"
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  
  // Fetch the specific command mapping
  const { 
    data: mapping, 
    isLoading: isLoadingMapping,
    error: mappingError 
  } = useQuery<CommandMapping>({
    queryKey: [`/api/mappings/${id}`],
    enabled: !!id,
  });
  
  // Fetch bots to get bot details
  const { 
    data: bots, 
    isLoading: isLoadingBots 
  } = useQuery<Bot[]>({
    queryKey: ["/api/bots"],
  });
  
  const bot = bots?.find(b => b.id === mapping?.botId);
  
  // Initialize edit form when mapping data loads
  useEffect(() => {
    if (mapping) {
      setEditForm({
        name: mapping.name,
        naturalLanguagePattern: mapping.naturalLanguagePattern,
        commandOutput: mapping.commandOutput,
        status: mapping.status || "active"
      });
    }
  }, [mapping]);
  
  const handleEdit = async () => {
    setEditLoading(true);
    setEditError(null);
    
    try {
      const response = await apiRequest(`/api/mappings/${id}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      setShowEditModal(false);
      // Refresh the mapping data
      window.location.reload();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Failed to update command mapping");
    } finally {
      setEditLoading(false);
    }
  };
  
  const openEditModal = () => {
    if (mapping) {
      setEditForm({
        name: mapping.name,
        naturalLanguagePattern: mapping.naturalLanguagePattern,
        commandOutput: mapping.commandOutput,
        status: mapping.status || "active"
      });
      setEditError(null);
      setShowEditModal(true);
    }
  };
  
  if (isLoadingMapping || isLoadingBots) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }
  
  if (mappingError || !mapping) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <MessageCircleIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Command mapping not found</h2>
          <p className="text-gray-500 mb-6">
            The command mapping you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/mappings")}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Command Mappings
          </Button>
        </div>
      </div>
    );
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "draft":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "disabled":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };
  
  const getPlatformIcon = () => {
    if (!bot) return <BotIcon className="h-5 w-5" />;
    
    if (bot.platformType === "discord") {
      return <SiDiscord className="h-5 w-5 text-blue-500" />;
    } else if (bot.platformType === "telegram") {
      return <SiTelegram className="h-5 w-5 text-blue-400" />;
    }
    
    return <BotIcon className="h-5 w-5" />;
  };
  
  const usageCount = mapping.usageCount || 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/mappings")}
            className="flex items-center gap-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{mapping.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge className={cn("text-xs", getStatusColor(mapping.status || "active"))}>
                {(mapping.status || "active").charAt(0).toUpperCase() + (mapping.status || "active").slice(1)}
              </Badge>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                {getPlatformIcon()}
                <span>{bot?.botName || "Unknown Bot"}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={openEditModal}>
            <EditIcon className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Natural Language Pattern */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircleIcon className="h-5 w-5" />
                Natural Language Pattern
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-800 font-medium">"{mapping.naturalLanguagePattern}"</p>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                This is the phrase pattern that users can say to trigger this command.
              </p>
            </CardContent>
          </Card>
          
          {/* Command Output */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BotIcon className="h-5 w-5" />
                Command Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4">
                <code className="text-sm text-gray-800">{mapping.commandOutput}</code>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                This is the actual Discord command that gets executed when the pattern is matched.
              </p>
            </CardContent>
          </Card>
          
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Usage</CardTitle>
            </CardHeader>
            <CardContent>
              {usageCount > 0 ? (
                <div className="text-center py-8">
                  <TrendingUpIcon className="h-8 w-8 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-gray-900">Used {usageCount} times</p>
                  <p className="text-sm text-gray-500">in the past week</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageCircleIcon className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No usage recorded yet</p>
                  <p className="text-sm text-gray-400">Try using this command in your Discord server</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Right Column - Stats & Info */}
        <div className="space-y-6">
          {/* Bot Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bot Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bot ? (
                <>
                  <div className="flex items-center gap-3">
                    {getPlatformIcon()}
                    <div>
                      <p className="font-medium text-gray-900">{bot.botName}</p>
                      <p className="text-sm text-gray-500 capitalize">{bot.platformType}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      bot.isConnected ? "bg-green-400" : "bg-red-400"
                    )} />
                    <span className="text-sm text-gray-600">
                      {bot.isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">Bot information unavailable</div>
              )}
            </CardContent>
          </Card>
          
          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Uses</span>
                <span className="font-semibold">{usageCount}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">This Week</span>
                <span className="font-semibold">{usageCount}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="font-semibold text-green-600">
                  {usageCount > 0 ? "100%" : "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>
          
          {/* Creation Info */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <Badge className={cn("text-xs", getStatusColor(mapping.status || "active"))}>
                  {(mapping.status || "active").charAt(0).toUpperCase() + (mapping.status || "active").slice(1)}
                </Badge>
              </div>
              
              {mapping.createdAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Created</span>
                  <span className="text-sm font-medium">
                    {format(new Date(mapping.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Command ID</span>
                <span className="text-xs font-mono text-gray-500">{mapping.id}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Edit Command Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Command Mapping</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowEditModal(false)}
                className="p-1"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Command Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  placeholder="Enter command name"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-pattern">Natural Language Pattern</Label>
                <Input
                  id="edit-pattern"
                  value={editForm.naturalLanguagePattern}
                  onChange={(e) => setEditForm({...editForm, naturalLanguagePattern: e.target.value})}
                  placeholder="Enter natural language pattern"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Use curly braces for variables: {"{user}"}, {"{reason}"}
                </p>
              </div>
              
              <div>
                <Label htmlFor="edit-output">Command Output</Label>
                <Textarea
                  id="edit-output"
                  value={editForm.commandOutput}
                  onChange={(e) => setEditForm({...editForm, commandOutput: e.target.value})}
                  placeholder="Enter Discord command output"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{editError}</p>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleEdit}
                  disabled={!editForm.name.trim() || !editForm.naturalLanguagePattern.trim() || !editForm.commandOutput.trim() || editLoading}
                >
                  {editLoading ? (
                    <>
                      <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 