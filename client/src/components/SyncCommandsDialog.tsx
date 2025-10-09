import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface SyncCommandsDialogProps {
  botId: string | null;
  open: boolean;
  onClose: () => void;
  onSynced?: () => void;
}

export default function SyncCommandsDialog({ botId, open, onClose, onSynced }: SyncCommandsDialogProps) {
  const [text, setText] = useState<string>(`[
  { "name": "pin", "naturalLanguagePattern": "pin this message", "commandOutput": "/pin" },
  { "name": "purge", "naturalLanguagePattern": "purge {amount} messages", "commandOutput": "/purge {amount}" },
  { "name": "say", "naturalLanguagePattern": "say {message}", "commandOutput": "/say message={message}" }
]`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    try {
      let commands: any[] = [];
      try { commands = JSON.parse(text); } catch {
        setError("Invalid JSON. Provide an array of commands.");
        setLoading(false);
        return;
      }
      if (!Array.isArray(commands)) {
        setError("Commands must be an array.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/relay/commands/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, commands })
      });
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      onClose();
      if (onSynced) onSynced();
    } catch (e: any) {
      setError(e?.message || "Sync failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sync Commands</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Paste your command manifest as JSON. Each item should include name, naturalLanguagePattern, and commandOutput.</p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} />
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSync} disabled={loading || !botId}>{loading ? "Syncing..." : "Sync"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


