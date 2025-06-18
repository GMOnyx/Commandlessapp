import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
}

export default function BotCreationDialog({ open, onOpenChange }: BotCreationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Define form schema
  const formSchema = z.object({
    botName: z.string().min(3, "Bot name must be at least 3 characters"),
    platformType: z.enum(["discord", "telegram"], {
      required_error: "Please select a platform type",
    }),
    token: z.string().min(5, "Token must be at least 5 characters"),
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
  
  // Token validation state (simplified - now just for UI feedback)
  const [tokenValidation, setTokenValidation] = useState<{
    isValidating?: boolean;
    valid?: boolean;
    message?: string;
  }>({ isValidating: false });
  
  // Create bot mutation
  const createBotMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      await apiRequest("/api/bots", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({
        title: "Success",
        description: "Bot created successfully",
      });
      form.reset();
      setTokenValidation({ isValidating: false });
      onOpenChange(false);
    },
    onError: (error) => {
      let errorMessage = "Failed to create bot";
      let errorDetails = "";
      let errorSuggestion = "";
      
      if (error instanceof Error) {
        try {
          // Try to parse the error message as JSON (from our improved backend)
          const jsonMatch = error.message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.error || errorMessage;
            errorDetails = errorData.details || "";
            errorSuggestion = errorData.suggestion || "";
          } else if (error.message.includes("409:")) {
            // Handle 409 Conflict errors specifically
            const conflictMatch = error.message.match(/409:\s*(.+)/);
            if (conflictMatch) {
              try {
                const conflictData = JSON.parse(conflictMatch[1]);
                errorMessage = conflictData.error || "Duplicate bot token";
                errorDetails = conflictData.details || "";
                errorSuggestion = conflictData.suggestion || "";
              } catch {
                errorMessage = "This Discord bot token is already in use";
                errorDetails = "Each Discord bot can only be connected to one account.";
                errorSuggestion = "Please create a new Discord bot or use a different token.";
              }
            }
          } else if (error.message.includes("400:")) {
            // Handle 400 validation errors (including Discord token validation)
            const validationMatch = error.message.match(/400:\s*(.+)/);
            if (validationMatch) {
              try {
                const validationData = JSON.parse(validationMatch[1]);
                errorMessage = validationData.error || "Validation error";
                errorDetails = validationData.details || "";
                errorSuggestion = validationData.suggestion || "";
              } catch {
                errorMessage = "Invalid bot token or configuration";
                errorDetails = "Please check your bot token and try again.";
                errorSuggestion = "Ensure you copied the complete token from the Discord Developer Portal.";
              }
            }
          } else {
            errorMessage = error.message;
          }
        } catch {
          errorMessage = error.message;
        }
      }
      
      // Create a comprehensive error message
      let fullErrorMessage = errorMessage;
      if (errorDetails) {
        fullErrorMessage += `\n\n${errorDetails}`;
      }
      if (errorSuggestion) {
        fullErrorMessage += `\n\nSuggestion: ${errorSuggestion}`;
      }
      
      toast({
        title: "Error Creating Bot",
        description: fullErrorMessage,
        variant: "destructive",
        duration: 8000, // Show longer for detailed errors
      });
    },
  });
  
  // Reset validation when token changes (disabled validation to prevent false errors)
  const handleTokenChange = (value: string) => {
    form.setValue("token", value);
    // Disable frontend validation since it was causing false errors
    // Real validation happens on the backend when creating the bot
    setTokenValidation({ isValidating: false });
  };
  
  // Handle form submission
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createBotMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add a new bot</DialogTitle>
          <DialogDescription>
            Connect a Discord or Telegram bot to start creating conversational interfaces.
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
            
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Token</FormLabel>
                  <FormControl>
                    <div className="relative">
                    <Input 
                      placeholder="Enter your bot token" 
                      type="password"
                      {...field} 
                        onChange={(e) => {
                          field.onChange(e);
                          handleTokenChange(e.target.value);
                        }}
                      />
                      {form.watch("platformType") === "discord" && field.value && (
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
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch("platformType") === "discord" && (
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
            
            {form.watch("platformType") === "discord" && (
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
                  <FormLabel>Bot Personality & Context (Optional)</FormLabel>
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
                {createBotMutation.isPending ? "Connecting..." : "Connect Bot"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 