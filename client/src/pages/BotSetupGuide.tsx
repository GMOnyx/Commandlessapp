import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, ExternalLink, CheckCircle, AlertCircle, Code, Book } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SetupGuide {
  title: string;
  description: string;
  steps: Array<{
    step: number;
    title: string;
    description: string;
    url?: string;
    details: string[];
    webhook?: {
      url: string;
      method: string;
      headers: object;
      body: object;
    };
  }>;
  sampleCode: {
    language: string;
    description: string;
    code: string;
  };
  troubleshooting: Array<{
    issue: string;
    solutions: string[];
  }>;
  endpoints: {
    processMessage: string;
    validateToken: string;
    createBot: string;
  };
}

export default function BotSetupGuide() {
  const [guide, setGuide] = useState<SetupGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchGuide = async () => {
      try {
        const response = await fetch('/api/discord?action=setup-guide');
        if (response.ok) {
          const guideData = await response.json();
          setGuide(guideData);
        }
      } catch (error) {
        console.error('Failed to fetch setup guide:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGuide();
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load setup guide. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{guide.title}</h1>
        <p className="text-muted-foreground mt-2">{guide.description}</p>
        
        <Alert className="mt-4">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Your Discord bot will use Commandless AI to process messages and respond intelligently. 
            Follow this guide to connect your bot to our AI processing system.
          </AlertDescription>
        </Alert>
      </div>

      <Tabs defaultValue="steps" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="steps">Setup Steps</TabsTrigger>
          <TabsTrigger value="code">Sample Code</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="space-y-6">
          {guide.steps.map((step) => (
            <Card key={step.step}>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">Step {step.step}</Badge>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  {step.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(step.url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                  )}
                </div>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {step.details.map((detail, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{detail}</span>
                    </li>
                  ))}
                </ul>
                
                {step.webhook && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Webhook Configuration:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">URL:</span>
                        <code className="bg-white px-2 py-1 rounded text-xs">{step.webhook.url}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(step.webhook!.url, 'Webhook URL')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div>
                        <span className="font-medium">Method:</span> {step.webhook.method}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="code">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Code className="h-5 w-5" />
                <span>{guide.sampleCode.description}</span>
              </CardTitle>
              <CardDescription>
                Copy this code and replace 'YOUR_BOT_TOKEN_HERE' with your actual bot token.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{guide.sampleCode.code}</code>
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(guide.sampleCode.code, 'Sample code')}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> You'll need to install discord.js first: <code>npm install discord.js</code>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshooting">
          <div className="space-y-4">
            {guide.troubleshooting.map((item, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg text-red-600">{item.issue}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {item.solutions.map((solution, sIndex) => (
                      <li key={sIndex} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{solution}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Book className="h-5 w-5" />
              <span>API Endpoints</span>
            </CardTitle>
            <CardDescription>
              Use these endpoints for advanced integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">Message Processing</div>
                  <code className="text-sm text-gray-600">{guide.endpoints.processMessage}</code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(guide.endpoints.processMessage, 'Process message endpoint')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">Token Validation</div>
                  <code className="text-sm text-gray-600">{guide.endpoints.validateToken}</code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(guide.endpoints.validateToken, 'Validate token endpoint')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 