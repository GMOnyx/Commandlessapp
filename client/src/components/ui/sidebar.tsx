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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
              <rect width="24" height="24" rx="5" fill="#7352FF" />
              <path d="M6 10C6 7.79086 7.79086 6 10 6H14C16.2091 6 18 7.79086 18 10V14C18 16.2091 16.2091 18 14 18H10C7.79086 18 6 16.2091 6 14V10Z" fill="white" />
              <path d="M8 11C8 9.89543 8.89543 9 10 9H14C15.1046 9 16 9.89543 16 11V13C16 14.1046 15.1046 15 14 15H10C8.89543 15 8 14.1046 8 13V11Z" fill="#7352FF" />
            </svg>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500">Commandless</span>
          </div>
          
          <nav className="mt-8 flex-1 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              
              return (
                <div 
                  key={item.href} 
                  className="w-full"
                >
                  <Link 
                    href={item.href}
                    className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                      isActive 
                        ? "bg-purple-50 text-primary" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-primary"
                    )}
                  >
                    <Icon className={cn(
                      "mr-3 flex-shrink-0 h-5 w-5",
                      isActive ? "text-primary" : "text-gray-500"
                    )} />
                    {item.label}
                  </Link>
                </div>
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
