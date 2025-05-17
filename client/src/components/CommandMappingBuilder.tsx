import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent,
  CardFooter 
} from "@/components/ui/card";
import { 
  Form, 
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { testCommandMapping } from "@/lib/openai";
import { extractVariablesFromPattern } from "@/lib/openai";
import { useToast } from "@/hooks/use-toast";
import { BotIcon } from "lucide-react";

interface CommandMappingBuilderProps {
  bots: Bot[];
}

export default function CommandMappingBuilder({ bots }: CommandMappingBuilderProps) {
  const [variables, setVariables] = useState<string[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Form schema
  const formSchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    botId: z.coerce.number().positive("Please select a bot"),
    status: z.string(),
    naturalLanguagePattern: z.string().min(5, "Pattern must be at least 5 characters"),
    commandOutput: z.string().min(5, "Command must be at least 5 characters"),
  });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      botId: undefined,
      status: "active",
      naturalLanguagePattern: "",
      commandOutput: "",
    },
  });
  
  // Handle natural language pattern changes to extract variables
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "naturalLanguagePattern") {
        const pattern = value.naturalLanguagePattern;
        if (pattern) {
          setVariables(extractVariablesFromPattern(pattern));
        } else {
          setVariables([]);
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch]);
  
  // Create command mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      await apiRequest("POST", "/api/mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mappings"] });
      toast({
        title: "Success",
        description: "Command mapping created successfully",
      });
      form.reset();
      setTestInput("");
      setTestOutput("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create command mapping: ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    },
  });
  
  // Handle testing the command
  const handleTestCommand = async () => {
    if (!testInput || !form.getValues("naturalLanguagePattern") || !form.getValues("commandOutput")) {
      toast({
        title: "Warning",
        description: "Please fill in all fields to test the command",
        variant: "destructive",
      });
      return;
    }
    
    setIsTesting(true);
    
    try {
      // Simulate API request since we don't have a saved mapping yet
      const nlPattern = form.getValues("naturalLanguagePattern");
      const cmdOutput = form.getValues("commandOutput");
      
      // For testing purposes, we'll do a simple variable replacement
      // In a real application, this would use the AI-powered OpenAI API
      let result = cmdOutput;
      for (const variable of variables) {
        const placeholder = `{${variable}}`;
        const regex = new RegExp(`{${variable}}`, 'g');
        
        // Extract value from test input
        // This is a simplistic approach - OpenAI would do this more intelligently
        if (testInput.includes(variable)) {
          const value = testInput.split(variable)[1]?.trim().split(" ")[0] || variable;
          result = result.replace(regex, value);
        }
      }
      
      setTestOutput(result);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test command",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createMappingMutation.mutate(data);
  };
  
  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-6">
                    <FormLabel>Mapping Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Employee Welcome Message" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="botId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>Platform</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a bot" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bots.map((bot) => (
                          <SelectItem key={bot.id} value={bot.id.toString()}>
                            {bot.botName} ({bot.platformType})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="naturalLanguagePattern"
                render={({ field }) => (
                  <FormItem className="sm:col-span-6">
                    <FormLabel>Natural Language Pattern</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="welcome {user} to the {team} team" 
                          {...field} 
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <BotIcon className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </FormControl>
                    <p className="mt-2 text-sm text-gray-500">
                      Use {"{variables}"} as placeholders for dynamic content that will be replaced at runtime.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="commandOutput"
                render={({ field }) => (
                  <FormItem className="sm:col-span-6 relative">
                    <FormLabel>Command Output</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="!welcome @{user} Welcome to the {team} team! Please check your email for onboarding materials." 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 w-1 h-8 bg-primary"></div>
                  </FormItem>
                )}
              />
              
              <div className="sm:col-span-6">
                <FormLabel className="block text-sm font-medium text-gray-700">
                  Available Variables
                </FormLabel>
                <div className="mt-1 flex flex-wrap gap-2">
                  {variables.length > 0 ? (
                    variables.map((variable) => (
                      <Badge 
                        key={variable} 
                        variant="outline"
                        className="bg-blue-100 text-blue-800 hover:bg-blue-200"
                      >
                        {"{" + variable + "}"}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No variables defined yet</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-8 border-t border-gray-200 pt-5">
              <h3 className="text-md font-medium text-gray-700">Test Your Command</h3>
              <div className="mt-2 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-6">
                  <FormLabel htmlFor="test-input">
                    Try Natural Language Input
                  </FormLabel>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <Input
                      id="test-input"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="welcome Jane to the marketing team"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleTestCommand}
                        disabled={isTesting}
                        className="text-primary hover:text-blue-500"
                      >
                        {isTesting ? "Testing..." : "Test"}
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="sm:col-span-6">
                  <FormLabel htmlFor="test-output">
                    Preview Result
                  </FormLabel>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <div className="flex items-start">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <BotIcon className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="ml-3 text-sm text-gray-700">
                        <p id="test-output">
                          {testOutput || "Preview will appear here after you test your command"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createMappingMutation.isPending}
              >
                {createMappingMutation.isPending ? "Saving..." : "Save Mapping"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
