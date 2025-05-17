import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  HomeIcon, 
  MessageSquareTextIcon, 
  BotIcon, 
  UsersIcon, 
  BarChartIcon, 
  SettingsIcon 
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SidebarProps {
  user: User | null;
}

export default function Sidebar({ user }: SidebarProps) {
  const [location] = useLocation();
  
  const navItems = [
    { 
      href: "/", 
      label: "Dashboard", 
      icon: HomeIcon 
    },
    { 
      href: "/mappings", 
      label: "Command Mappings", 
      icon: MessageSquareTextIcon 
    },
    { 
      href: "/connections", 
      label: "Bot Connections", 
      icon: BotIcon 
    },
    { 
      href: "/analytics", 
      label: "Analytics", 
      icon: BarChartIcon 
    },
    { 
      href: "/settings", 
      label: "Settings", 
      icon: SettingsIcon 
    }
  ];

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 border-r border-gray-200 bg-white">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <span className="text-xl font-bold text-gray-800">CommandHub</span>
          </div>
          
          <nav className="mt-8 flex-1 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                >
                  <a 
                    className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                      isActive 
                        ? "bg-gray-100 text-gray-900" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon className="mr-3 flex-shrink-0 h-5 w-5 text-gray-500" />
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </nav>
        </div>
        
        {/* User profile section */}
        {user && (
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div>
                <Avatar>
                  <AvatarImage src={user.avatar || undefined} alt={user.name || user.username} />
                  <AvatarFallback>{user.name?.[0] || user.username[0]}</AvatarFallback>
                </Avatar>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{user.name || user.username}</p>
                <p className="text-xs font-medium text-gray-500">{user.role || "Team Member"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
