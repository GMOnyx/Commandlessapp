import APIKeysPanel from "@/components/APIKeysPanel";
import { Card } from "@/components/ui/card";

export default function APIKeysPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white/60 backdrop-blur-xl border border-gray-200/50 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">API Keys</h1>
        </div>
        <p className="text-base text-gray-600">
          Manage API keys for your bots. Each key is bound to a specific bot and automatically uses that bot's personality and configuration.
        </p>
      </div>

      <APIKeysPanel />
    </div>
  );
}

