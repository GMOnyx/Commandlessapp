import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bot } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface BotCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editBot?: Bot; // Optional bot to edit
}

export default function BotCreationDialog({ open, onOpenChange, editBot }: BotCreationDialogProps) {
  const [tokenValidation, setTokenValidation] = useState<{
    valid?: boolean;
    message?: string;
    isValidating: boolean;
  }>({ isValidating: false });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isEditMode = !!editBot;
  
  // Define form schema - make fields optional for edit mode
  const formSchema = z.object({
    botName: z.string().min(3, "Bot name must be at least 3 characters"),
    platformType: isEditMode 
      ? z.enum(["discord", "telegram"]).optional()
      : z.enum(["discord", "telegram"], { required_error: "Please select a platform type" }),
    token: isEditMode 
      ? z.string().optional()
      : z.string().min(5, "Token must be at least 5 characters"),
    clientId: z.string().optional(),
    personalityContext: z.string().optional(),
  });
  
  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      botName: "",
      platformType: undefined,
      token: "",
      clientId: "",
      personalityContext: "",
    },
  });
  
  // Populate form when editing
  useEffect(() => {
    if (editBot && open) {
      form.reset({
        botName: editBot.botName,
        platformType: editBot.platformType,
        token: "", // Don't populate token for security
        clientId: "",
        personalityContext: editBot.personalityContext || "",
      });
      setTokenValidation({ isValidating: false });
    } else if (!editBot && open) {
      form.reset({
        botName: "",
        platformType: undefined,
        token: "",
        clientId: "",
        personalityContext: "",
      });
      setTokenValidation({ isValidating: false });
    }
  }, [editBot, open, form]);
  
  // Create/Update bot mutation
  const createBotMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (isEditMode) {
        // Update existing bot - only send changed fields
        const updateData: any = { botName: data.botName };
        if (data.token && data.token.trim()) updateData.token = data.token;
        if (data.personalityContext !== undefined) updateData.personalityContext = data.personalityContext;
        
        return await apiRequest(`/api/bots?botId=${editBot.id}`, {
          method: "PUT",
          body: JSON.stringify(updateData),
        });
      } else {
        // Create new bot
        return await apiRequest("/api/bots", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      const botId = data?.id || data?.botId || editBot?.id;
      toast({
        title: "Success",
        description: isEditMode 
          ? "Bot updated successfully" 
          : `Bot created successfully! Bot ID: ${botId}`,
        duration: 8000,
      });
      form.reset();
      setTokenValidation({ isValidating: false });
      onOpenChange(false);
      
      // Show bot ID prominently if this is a new bot
      if (!isEditMode && botId) {
        setTimeout(() => {
          toast({
            title: "Important: Save Your Bot ID",
            description: `Your Bot ID is ${botId}. You'll need this for your BOT_ID environment variable when using the SDK.`,
            duration: 10000,
          });
        }, 500);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} bot: ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    },
  });
  
  // Token validation function
  const validateDiscordToken = async (token: string) => {
    if (!token || token.length < 50) {
      setTokenValidation({ valid: false, message: "Token appears too short", isValidating: false });
      return;
    }

    setTokenValidation({ isValidating: true });
    
    try {
      const result = await apiRequest("/api/validate-token", {
        method: "POST",
        body: JSON.stringify({ botToken: token }),
      });
      
      setTokenValidation({
        valid: result.valid,
        message: result.message,
        isValidating: false
      });
    } catch (error) {
      setTokenValidation({
        valid: false,
        message: "Error validating token",
        isValidating: false
      });
    }
  };

  // Reset validation when token changes
  const handleTokenChange = (value: string) => {
    form.setValue("token", value);
    setTokenValidation({ isValidating: false });
    
    // Auto-validate Discord tokens after user stops typing
    const platformType = form.getValues("platformType") || editBot?.platformType;
    if (platformType === "discord" && value.length > 50) {
      const timeoutId = setTimeout(() => validateDiscordToken(value), 1000);
      return () => clearTimeout(timeoutId);
    }
  };
  
  // Handle form submission
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createBotMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit bot credentials" : "Add a new bot"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update your bot's credentials. Only change the fields you want to update."
              : "Connect a Discord or Telegram bot to start creating conversational interfaces."
            }
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="botName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Marketing Team Bot" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {!isEditMode && (
              <FormField
                control={form.control}
                name="platformType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="discord">Discord</SelectItem>
                        <SelectItem value="telegram" disabled className="text-gray-400">
                          Telegram (coming soon)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {isEditMode && (
              <div className="p-3 bg-gray-50 rounded-md space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Platform:</strong> {editBot.platformType.charAt(0).toUpperCase() + editBot.platformType.slice(1)}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">
                    <strong>Bot ID:</strong> <code className="font-mono text-xs bg-white px-2 py-1 rounded border">{editBot.id}</code>
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(editBot.id));
                      toast({
                        title: "Copied!",
                        description: "Bot ID copied to clipboard",
                        duration: 2000,
                      });
                    }}
                    className="text-xs text-primary hover:text-primary-600 focus:outline-none"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 italic">Use this Bot ID for your BOT_ID environment variable in the SDK</p>
              </div>
            )}
            
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Bot Token {isEditMode && <span className="text-sm text-gray-500">(optional)</span>}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                    <Input 
                      placeholder={isEditMode ? "Enter new token to update (leave empty to keep current)" : "Enter your bot token"} 
                      type="password"
                      {...field} 
                        onChange={(e) => {
                          field.onChange(e);
                          handleTokenChange(e.target.value);
                        }}
                      />
                      {((form.watch("platformType") === "discord") || (editBot?.platformType === "discord")) && field.value && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          {tokenValidation.isValidating ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : tokenValidation.valid === true ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : tokenValidation.valid === false ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  {tokenValidation.message && (
                    <p className={`text-sm ${tokenValidation.valid ? 'text-green-600' : 'text-red-600'}`}>
                      {tokenValidation.message}
                    </p>
                  )}
                  {isEditMode && (
                    <p className="text-xs text-gray-500">
                      Leave empty to keep current token. Only update if you need to change it.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {((form.watch("platformType") === "discord") || (editBot?.platformType === "discord")) && !isEditMode && (
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                <p className="font-medium mb-1">📖 How to get your Discord bot token:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Discord Developer Portal</a></li>
                  <li>Create a new application or select existing one</li>
                  <li>Go to "Bot" section in the sidebar</li>
                  <li>Click "Reset Token" and copy the new token</li>
                  <li>Make sure bot has "bot" and "applications.commands" scopes</li>
                </ol>
              </div>
            )}
            
            {((form.watch("platformType") === "discord") || (editBot?.platformType === "discord")) && !isEditMode && (
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client ID (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Discord Client ID" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="personalityContext"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Bot Personality & Context {isEditMode && <span className="text-sm text-gray-500">(optional)</span>}
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="e.g., You're a friendly moderation bot for a gaming community. Be casual but firm when enforcing rules about toxicity and spam. The server culture is relaxed but professional."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          
            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createBotMutation.isPending}
              >
                {createBotMutation.isPending 
                  ? (isEditMode ? "Updating..." : "Connecting...") 
                  : (isEditMode ? "Update Bot" : "Connect Bot")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 