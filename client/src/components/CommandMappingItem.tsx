import { CommandMapping, Bot } from "@shared/schema";
import { Link } from "wouter";
import { SiDiscord, SiTelegram } from "react-icons/si";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CommandMappingItemProps {
  mapping: CommandMapping;
  bots: Bot[];
}

export default function CommandMappingItem({ mapping, bots }: CommandMappingItemProps) {
  const bot = bots.find(b => b.id === mapping.botId);
  
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
  
  return (
    <li>
      <Link href={`/mappings/${mapping.id}`}>
        <a className="block hover:bg-gray-50">
          <div className="px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <p className="text-sm font-medium text-primary truncate">
                  {mapping.name}
                </p>
                <div className="ml-2 flex-shrink-0 flex">
                  <p className={cn(
                    "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                    getStatusColor(mapping.status)
                  )}>
                    {mapping.status.charAt(0).toUpperCase() + mapping.status.slice(1)}
                  </p>
                </div>
              </div>
              <div className="ml-2 flex-shrink-0 flex">
                <p className="flex items-center text-sm text-gray-500">
                  {renderPlatformIcon()}
                  {bot?.platformType === "discord" ? "Discord" : "Telegram"}
                </p>
              </div>
            </div>
            <div className="mt-2 sm:flex sm:justify-between">
              <div className="sm:flex">
                <p className="flex items-center text-sm text-gray-600">
                  <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
                  </svg>
                  "{mapping.naturalLanguagePattern}"
                </p>
              </div>
              <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                <p>
                  Used {mapping.usageCount} times {mapping.usageCount > 0 ? "this week" : ""}
                </p>
              </div>
            </div>
          </div>
        </a>
      </Link>
    </li>
  );
}
