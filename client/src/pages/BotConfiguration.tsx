import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Shield,
  MessageSquare,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

interface BotConfig {
  id: number;
  botId: number;
  version: number;
  enabled: boolean;
  channelMode: 'all' | 'whitelist' | 'blacklist';
  enabledChannels: string[];
  disabledChannels: string[];
  permissionMode: 'all' | 'whitelist' | 'blacklist' | 'premium_only';
  enabledRoles: string[];
  disabledRoles: string[];
  enabledUsers: string[];
  disabledUsers: string[];
  premiumRoleIds: string[];
  enabledCommandCategories: string[];
  disabledCommands: string[];
  commandMode: 'all' | 'category_based' | 'whitelist' | 'blacklist';
  mentionRequired: boolean;
  customPrefix: string | null;
  triggerMode: 'mention' | 'prefix' | 'always';
  freeRateLimit: number;
  premiumRateLimit: number;
  serverRateLimit: number;
  confidenceThreshold: number;
  requireConfirmation: boolean;
  dangerousCommands: string[];
  responseStyle: 'friendly' | 'professional' | 'minimal';
  createdAt: string;
  updatedAt: string;
}

export default function BotConfiguration() {
  const [, params] = useRoute("/bots/:id/config");
  const botId = params?.id;
  const queryClient = useQueryClient();

  // Fetch bot config
  const { data: config, isLoading } = useQuery<BotConfig>({
    queryKey: [`/api/bots/${botId}/config`],
    enabled: !!botId,
  });

  // Local state for form
  const [formData, setFormData] = useState<Partial<BotConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data when config loads
  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  // Track changes
  useEffect(() => {
    if (config) {
      setHasChanges(JSON.stringify(formData) !== JSON.stringify(config));
    }
  }, [formData, config]);

  // Update config mutation
  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<BotConfig>) => {
      return apiRequest(`/api/bots/${botId}/config`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bots/${botId}/config`] });
      setHasChanges(false);
    },
  });

  const handleSave = () => {
    updateConfig.mutate(formData);
  };

  const handleReset = () => {
    if (config) {
      setFormData(config);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card className="p-6">
          <p className="text-red-500">Failed to load configuration</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bot Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Control where, when, and how your bot processes AI requests
          </p>
        </div>
        <Badge variant={formData.enabled ? "default" : "secondary"}>
          {formData.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </div>

      {/* Master Enable/Disable */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-semibold">Enable AI Processing</Label>
            <p className="text-sm text-gray-500">
              Master switch for all AI features. When disabled, the SDK ignores all messages.
            </p>
          </div>
          <Switch
            checked={formData.enabled ?? true}
            onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
          />
        </div>
      </Card>

      {/* Channel Control */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Channel Control</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Specify which Discord channels the AI should respond in
        </p>

        <div className="space-y-4">
          <div>
            <Label>Channel Mode</Label>
            <Select
              value={formData.channelMode || 'all'}
              onValueChange={(value: any) => setFormData({ ...formData, channelMode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels (default)</SelectItem>
                <SelectItem value="whitelist">Only Selected Channels</SelectItem>
                <SelectItem value="blacklist">All Except Selected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.channelMode === 'whitelist' && (
            <div>
              <Label>Enabled Channels</Label>
              <Input
                placeholder="Channel IDs (comma-separated): 123456789, 987654321"
                value={(formData.enabledChannels || []).join(', ')}
                onChange={(e) => {
                  const channels = e.target.value
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  setFormData({ ...formData, enabledChannels: channels });
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Right-click a channel → Copy Channel ID
              </p>
            </div>
          )}

          {formData.channelMode === 'blacklist' && (
            <div>
              <Label>Disabled Channels</Label>
              <Input
                placeholder="Channel IDs (comma-separated): 123456789, 987654321"
                value={(formData.disabledChannels || []).join(', ')}
                onChange={(e) => {
                  const channels = e.target.value
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  setFormData({ ...formData, disabledChannels: channels });
                }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Permission Control */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">User & Role Permissions</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Control who can use AI features
        </p>

        <div className="space-y-4">
          <div>
            <Label>Permission Mode</Label>
            <Select
              value={formData.permissionMode || 'all'}
              onValueChange={(value: any) => setFormData({ ...formData, permissionMode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone (default)</SelectItem>
                <SelectItem value="whitelist">Only Selected Roles/Users</SelectItem>
                <SelectItem value="blacklist">Everyone Except Selected</SelectItem>
                <SelectItem value="premium_only">Premium Roles Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.permissionMode === 'premium_only' && (
            <div>
              <Label>Premium Role IDs</Label>
              <Input
                placeholder="Role IDs (comma-separated): 555666777, 888999000"
                value={(formData.premiumRoleIds || []).join(', ')}
                onChange={(e) => {
                  const roles = e.target.value
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  setFormData({ ...formData, premiumRoleIds: roles });
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Right-click a role → Copy Role ID
              </p>
            </div>
          )}

          {formData.permissionMode === 'whitelist' && (
            <div>
              <Label>Enabled Roles</Label>
              <Input
                placeholder="Role IDs (comma-separated)"
                value={(formData.enabledRoles || []).join(', ')}
                onChange={(e) => {
                  const roles = e.target.value
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  setFormData({ ...formData, enabledRoles: roles });
                }}
              />
            </div>
          )}

          {formData.permissionMode === 'blacklist' && (
            <div>
              <Label>Disabled Roles</Label>
              <Input
                placeholder="Role IDs (comma-separated)"
                value={(formData.disabledRoles || []).join(', ')}
                onChange={(e) => {
                  const roles = e.target.value
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  setFormData({ ...formData, disabledRoles: roles });
                }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Rate Limiting */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Rate Limits</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Prevent spam and control API usage costs
        </p>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Free Users</Label>
              <span className="text-sm font-medium">{formData.freeRateLimit ?? 10} requests/hour</span>
            </div>
            <Slider
              value={[formData.freeRateLimit ?? 10]}
              onValueChange={([value]) => setFormData({ ...formData, freeRateLimit: value })}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Premium Users</Label>
              <span className="text-sm font-medium">{formData.premiumRateLimit ?? 50} requests/hour</span>
            </div>
            <Slider
              value={[formData.premiumRateLimit ?? 50]}
              onValueChange={([value]) => setFormData({ ...formData, premiumRateLimit: value })}
              min={1}
              max={500}
              step={5}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Server Total</Label>
              <span className="text-sm font-medium">{formData.serverRateLimit ?? 100} requests/hour</span>
            </div>
            <Slider
              value={[formData.serverRateLimit ?? 100]}
              onValueChange={([value]) => setFormData({ ...formData, serverRateLimit: value })}
              min={10}
              max={1000}
              step={10}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Trigger Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Trigger Settings</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          How users activate the AI
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Mention or Reply</Label>
              <p className="text-xs text-gray-500">
                Only process messages when @mentioned or replying to bot
              </p>
            </div>
            <Switch
              checked={formData.mentionRequired !== false}
              onCheckedChange={(checked) => setFormData({ ...formData, mentionRequired: checked })}
            />
          </div>

          <Separator />

          <div>
            <Label>Trigger Mode</Label>
            <Select
              value={formData.triggerMode || 'mention'}
              onValueChange={(value: any) => setFormData({ ...formData, triggerMode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mention">Only When Mentioned (safest)</SelectItem>
                <SelectItem value="prefix">Custom Prefix</SelectItem>
                <SelectItem value="always">Always (all messages)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.triggerMode === 'prefix' && (
            <div>
              <Label>Custom Prefix</Label>
              <Input
                placeholder="e.g., ai, bot, !"
                value={formData.customPrefix || ''}
                onChange={(e) => setFormData({ ...formData, customPrefix: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Users will type: <code className="bg-gray-100 px-1 rounded">{formData.customPrefix || 'ai'} ban user</code>
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* AI Behavior */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">AI Behavior</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Fine-tune AI response quality and safety
        </p>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Confidence Threshold</Label>
              <span className="text-sm font-medium">{Math.round((formData.confidenceThreshold ?? 0.7) * 100)}%</span>
            </div>
            <Slider
              value={[(formData.confidenceThreshold ?? 0.7) * 100]}
              onValueChange={([value]) => setFormData({ ...formData, confidenceThreshold: value / 100 })}
              min={50}
              max={95}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Only execute commands if AI is this confident
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Confirmation</Label>
              <p className="text-xs text-gray-500">
                Ask "Are you sure?" before executing dangerous commands
              </p>
            </div>
            <Switch
              checked={formData.requireConfirmation || false}
              onCheckedChange={(checked) => setFormData({ ...formData, requireConfirmation: checked })}
            />
          </div>

          <div>
            <Label>Response Style</Label>
            <Select
              value={formData.responseStyle || 'friendly'}
              onValueChange={(value: any) => setFormData({ ...formData, responseStyle: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly & Conversational</SelectItem>
                <SelectItem value="professional">Professional & Formal</SelectItem>
                <SelectItem value="minimal">Minimal & Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Command Categories */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Command Categories</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Enable or disable entire categories of commands
        </p>

        <div className="space-y-3">
          {['moderation', 'utility', 'fun', 'economy'].map((category) => {
            const enabled = (formData.enabledCommandCategories || []).includes(category);
            return (
              <div key={category} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium capitalize">{category}</p>
                  <p className="text-xs text-gray-500">
                    {category === 'moderation' && 'ban, kick, warn, mute, timeout'}
                    {category === 'utility' && 'ping, help, info, server-info'}
                    {category === 'fun' && 'joke, meme, 8ball, roll'}
                    {category === 'economy' && 'balance, shop, daily, inventory'}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => {
                    const categories = formData.enabledCommandCategories || [];
                    const updated = checked
                      ? [...categories, category]
                      : categories.filter(c => c !== category);
                    setFormData({ ...formData, enabledCommandCategories: updated });
                  }}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Save/Reset Actions */}
      <div className="flex items-center justify-between sticky bottom-6 bg-white border rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2">
          {hasChanges ? (
            <>
              <XCircle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-gray-600">Unsaved changes</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-600">All changes saved</span>
            </>
          )}
          <Badge variant="outline" className="ml-2">
            v{config.version}
          </Badge>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || updateConfig.isPending}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateConfig.isPending}
          >
            {updateConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}

