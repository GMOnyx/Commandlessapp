import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Bot } from "@shared/schema";

type ApiKeyRow = {
  keyId: string;
  botId?: number | null;
  description?: string | null;
  scopes: string[];
  createdAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  rateLimitPerMin?: number | null;
};

export default function APIKeysPanel() {
  const qc = useQueryClient();
  const { data: keys, isLoading } = useQuery<ApiKeyRow[]>({ queryKey: ["/api/keys"] });
  const { data: bots } = useQuery<Bot[]>({ queryKey: ["/api/bots"] });

  const [openCreate, setOpenCreate] = useState(false);
  const [created, setCreated] = useState<{ keyId: string; secret: string } | null>(null);
  const [rotated, setRotated] = useState<{ keyId: string; secret: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [selectedBotId, setSelectedBotId] = useState<string>("");

  const createKey = useMutation({
    mutationFn: async () => {
      if (!selectedBotId) throw new Error("Please select a bot");
      const body = { 
        description: description || undefined,
        botId: parseInt(selectedBotId, 10)
      };
      return apiRequest("/api/keys", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (res: any) => {
      setCreated({ keyId: res.keyId, secret: res.secret });
      setDescription("");
      setSelectedBotId("");
      setOpenCreate(false);
      qc.invalidateQueries({ queryKey: ["/api/keys"] });
    }
  });

  const revokeKey = useMutation({
    mutationFn: async (keyId: string) => apiRequest(`/api/keys/${keyId}/revoke`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/keys"] })
  });

  const rotateKey = useMutation({
    mutationFn: async (keyId: string) => apiRequest(`/api/keys/${keyId}/rotate`, { method: "POST" }),
    onSuccess: (res: any) => {
      setRotated({ keyId: res.keyId, secret: res.secret });
      qc.invalidateQueries({ queryKey: ["/api/keys"] });
    }
  });

  const deleteKey = useMutation({
    mutationFn: async (keyId: string) => apiRequest(`/api/keys/${keyId}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ["/api/keys"] });
    }
  });

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">API Keys</h2>
          <p className="text-xs text-gray-500">Create, rotate or revoke keys used by the SDK.</p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>New Key</Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading keys…</div>
      ) : !keys || keys.length === 0 ? (
        <div className="text-sm text-gray-500">No keys yet.</div>
      ) : (
        <div className="space-y-3">
          {keys.map(k => {
            const bot = bots?.find(b => b.id === k.botId);
            return (
            <div key={k.keyId} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div className="min-w-0">
                <div className="font-mono text-sm truncate">{k.keyId}</div>
                <div className="text-xs text-gray-500 truncate">{k.description || ""}</div>
                {bot && (
                  <div className="text-xs text-gray-600 mt-1">Bot: {bot.botName}</div>
                )}
                <div className="flex flex-wrap gap-1 mt-1">
                  {(k.scopes || []).map(s => (<Badge key={s} variant="secondary">{s}</Badge>))}
                  {k.revokedAt && (<Badge variant="destructive">revoked</Badge>)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => rotateKey.mutate(k.keyId)} disabled={!!k.revokedAt}>Rotate</Button>
                <Button variant="secondary" onClick={() => revokeKey.mutate(k.keyId)} disabled={!!k.revokedAt}>Revoke</Button>
                <Button variant="destructive" onClick={() => setDeleteConfirm(k.keyId)} disabled={deleteKey.isPending}>Delete</Button>
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Bot *</label>
              <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bot" />
                </SelectTrigger>
                <SelectContent>
                  {bots && bots.length > 0 ? (
                    bots.map(bot => (
                      <SelectItem key={bot.id} value={String(bot.id)}>
                        {bot.botName}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>No bots available</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">This key will use this bot's personality and configuration.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Description (optional)</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. staging bot" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={() => createKey.mutate()} disabled={createKey.isPending || !selectedBotId}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy-once secret dialogs */}
      <Dialog open={!!created} onOpenChange={(o) => { if (!o) setCreated(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New API Key</DialogTitle>
          </DialogHeader>
          {created && (
            <div className="space-y-3">
              <div className="text-sm">Save this secret now. You won't see it again.</div>
              <div className="bg-gray-50 p-2 rounded font-mono text-sm break-all">{created.keyId}:{created.secret}</div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rotated} onOpenChange={(o) => { if (!o) setRotated(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotated API Key</DialogTitle>
          </DialogHeader>
          {rotated && (
            <div className="space-y-3">
              <div className="text-sm">Here is your new secret for {rotated.keyId}.</div>
              <div className="bg-gray-50 p-2 rounded font-mono text-sm break-all">{rotated.keyId}:{rotated.secret}</div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRotated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
          </DialogHeader>
          {deleteConfirm && (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                Are you sure you want to permanently delete <span className="font-mono font-semibold">{deleteConfirm}</span>?
              </div>
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                This action cannot be undone. Any applications using this key will stop working immediately.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={deleteKey.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteKey.mutate(deleteConfirm)} disabled={deleteKey.isPending}>
              {deleteKey.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


