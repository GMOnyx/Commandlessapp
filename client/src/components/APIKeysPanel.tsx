import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

type ApiKeyRow = {
  keyId: string;
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
  const { data: bots } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/bots"] });

  const [openCreate, setOpenCreate] = useState(false);
  const [created, setCreated] = useState<{ keyId: string; secret: string } | null>(null);
  const [rotated, setRotated] = useState<{ keyId: string; secret: string } | null>(null);
  const [description, setDescription] = useState("");
  const [botId, setBotId] = useState<string>("");

  const createKey = useMutation({
    mutationFn: async () => {
      const body = { description: description || undefined, botId: botId ? Number(botId) : undefined };
      return apiRequest("/api/keys", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (res: any) => {
      setCreated({ keyId: res.keyId, secret: res.secret });
      setDescription("");
      setBotId("");
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
          {keys.map(k => (
            <div key={k.keyId} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div className="min-w-0">
                <div className="font-mono text-sm truncate">{k.keyId}</div>
                <div className="text-xs text-gray-500 truncate">{k.description || ""}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(k.scopes || []).map(s => (<Badge key={s} variant="secondary">{s}</Badge>))}
                  {k.revokedAt && (<Badge variant="destructive">revoked</Badge>)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => rotateKey.mutate(k.keyId)} disabled={!!k.revokedAt}>Rotate</Button>
                <Button variant="destructive" onClick={() => revokeKey.mutate(k.keyId)} disabled={!!k.revokedAt}>Revoke</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm text-gray-700">Bind to bot</label>
            <Select value={botId} onValueChange={setBotId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={bots && bots.length ? "Select a bot" : "No bots found"} />
              </SelectTrigger>
              <SelectContent>
                {(bots || []).map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="text-sm text-gray-700">Description (optional)</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. staging bot" />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={() => createKey.mutate()} disabled={createKey.isPending || !botId}>Create</Button>
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
    </Card>
  );
}


