import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload } from "lucide-react";

interface TutorialSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: Bot;
}

interface TutorialDoc {
  id: string;
  title: string;
  content?: string;
  created_at?: string;
}

export default function TutorialSettingsDialog({ open, onOpenChange, bot }: TutorialSettingsDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [persona, setPersona] = useState<string>(bot.tutorialPersona || "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setPersona(bot.tutorialPersona || "");
  }, [open, bot.tutorialPersona]);

  const { data: docs, isLoading: loadingDocs } = useQuery<TutorialDoc[]>({
    queryKey: ["/api/tutorial-docs", bot.id],
    queryFn: async () => {
      const res = await apiRequest(`/api/tutorial-docs?botId=${bot.id}`);
      return res.docs || [];
    },
    enabled: open,
  });

  const savePersonaMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/bots?botId=${bot.id}` , {
        method: "PUT",
        body: JSON.stringify({ tutorialPersona: persona })
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({ title: "Saved", description: "Tutorial persona updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to save persona", variant: "destructive" })
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string }) => {
      return await apiRequest(`/api/tutorial-docs`, {
        method: "POST",
        body: JSON.stringify({ botId: bot.id, ...payload })
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/tutorial-docs", bot.id] });
      toast({ title: "Uploaded", description: "Document added to tutorial context." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to upload document", variant: "destructive" })
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      return await apiRequest(`/api/tutorial-docs?id=${docId}&botId=${bot.id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/tutorial-docs", bot.id] });
      toast({ title: "Deleted", description: "Document removed." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to delete document", variant: "destructive" })
  });

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        await uploadDocMutation.mutateAsync({ title: file.name, content: text });
      } catch (e: any) {
        toast({ title: `Failed to read ${file.name}`, description: e?.message || "", variant: "destructive" });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Tutorial Mode Settings</DialogTitle>
          <DialogDescription>
            Configure persona and add reference documents. These are used to explain and simulate commands without executing them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tutorial Persona & Context</label>
            <Textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="min-h-[160px]"
              placeholder="Describe the tutor persona, tone, and detailed bot/game guidance."
            />
            <div className="mt-2 text-xs text-gray-500">Tip: Include server culture, moderation style, and examples.</div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Tutorial Documents</label>
              <div className="text-xs text-gray-500">Markdown/Text supported. We’ll extract text client-side.</div>
            </div>
            <div className="flex items-center gap-2">
              <Input ref={fileInputRef} type="file" accept=".txt,.md,.markdown,.json,.csv,.log" multiple onChange={(e) => handleFilesSelected(e.target.files)} />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="whitespace-nowrap">
                <Upload className="h-4 w-4 mr-2" /> Upload
              </Button>
            </div>

            <div className="mt-3 border rounded-md divide-y">
              {loadingDocs ? (
                <div className="p-3 text-sm text-gray-500">Loading documents…</div>
              ) : (docs && docs.length > 0 ? (
                docs.map((d) => (
                  <div key={d.id} className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.title}</p>
                      <p className="text-xs text-gray-500">{d.created_at ? new Date(d.created_at).toLocaleString() : ''}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteDocMutation.mutate(d.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-gray-500">No documents yet. Upload files to provide in-depth tutorials.</div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => savePersonaMutation.mutate()} disabled={savePersonaMutation.isPending}>
            {savePersonaMutation.isPending ? 'Saving…' : 'Save Persona'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


