import { CommandMapping, Bot } from "@shared/schema";
import { Link } from "wouter";
import { SiDiscord, SiTelegram } from "react-icons/si";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TrendingUpIcon, MessageCircleIcon } from "lucide-react";

interface CommandMappingItemProps {
  mapping: CommandMapping;
  bots: Bot[];
}

export default function CommandMappingItem({ mapping, bots }: CommandMappingItemProps) {
  const bot = bots.find(b => b.id === mapping.botId);
  const usageCount = mapping.usageCount || 0;
  
  const renderPlatformIcon = () => {
    if (!bot) return null;
    
    if (bot.platformType === "discord") {
      return <SiDiscord className="mr-1.5 text-gray-400" />;
    } else if (bot.platformType === "telegram") {
      return <SiTelegram className="mr-1.5 text-gray-400" />;
    }
    
    return null;
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "disabled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getUsageInfo = () => {
    if (usageCount === 0) {
      return { text: "Not used yet", color: "text-gray-500", icon: MessageCircleIcon };
    } else if (usageCount < 10) {
      return { text: `${usageCount} uses`, color: "text-blue-600", icon: MessageCircleIcon };
    } else {
      return { text: `${usageCount} uses`, color: "text-green-600", icon: TrendingUpIcon };
    }
  };

  const usageInfo = getUsageInfo();
  const UsageIcon = usageInfo.icon;
  
  return (
    <li>
      <Link href={`/mappings/${mapping.id}`}>
        <a className="block hover:bg-gray-50 transition-colors">
          <div className="px-4 py-4 sm:px-6">
            {/* Mobile-first layout */}
            <div className="space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">
                    {mapping.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      "px-2 py-1 text-xs leading-4 font-semibold rounded-full",
                      getStatusColor(mapping.status || "active")
                    )}>
                      {(mapping.status || "active").charAt(0).toUpperCase() + (mapping.status || "active").slice(1)}
                    </span>
                    <span className="flex items-center text-xs text-gray-500">
                      {renderPlatformIcon()}
                      {bot?.platformType === "discord" ? "Discord" : "Telegram"}
                    </span>
                  </div>
                </div>
                
                {/* Usage stats - always visible on the right */}
                <div className="flex-shrink-0 text-right">
                  <div className={cn("flex items-center gap-1", usageInfo.color)}>
                    <UsageIcon className="h-3 w-3" />
                    <span className="text-xs font-medium">{usageInfo.text}</span>
                  </div>
                  {usageCount > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">this week</p>
                  )}
                </div>
              </div>
              
              {/* Natural language pattern */}
              <div className="flex items-start gap-2">
                <MessageCircleIcon className="flex-shrink-0 h-4 w-4 text-gray-400 mt-0.5" />
                <p className="text-sm text-gray-600 break-words">
                  "{mapping.naturalLanguagePattern}"
                </p>
              </div>
            </div>
          </div>
        </a>
      </Link>
    </li>
  );
}
