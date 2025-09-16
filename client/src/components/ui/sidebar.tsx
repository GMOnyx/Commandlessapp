import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  HomeIcon, 
  MessageSquareTextIcon, 
  BotIcon, 
  MenuIcon,
  XIcon
} from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { User } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SidebarProps {
  user: User | null;
  mobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
}

export default function Sidebar({ user, mobileMenuOpen = false, onMobileMenuClose }: SidebarProps) {
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
    }
  ];

  const closeMobileMenu = () => {
    onMobileMenuClose?.();
  };

  const NavContent = () => (
    <>
      <div className="flex items-center flex-shrink-0 px-4 mb-6">
        <img src="/commandless.svg" alt="Commandless" className="h-8 w-auto" />
      </div>
      
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href}
              href={item.href}
              onClick={closeMobileMenu}
              className={cn(
                "group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors",
                isActive 
                  ? "bg-indigo-50 text-primary" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-primary"
              )}
            >
              <Icon className={cn(
                "mr-3 flex-shrink-0 h-5 w-5",
                isActive ? "text-primary" : "text-gray-500 group-hover:text-primary"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={closeMobileMenu} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={closeMobileMenu}
              >
                <XIcon className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <NavContent />
            </div>
            {user && (
              <div className="flex-shrink-0 flex justify-center border-t border-gray-100 p-4">
                <UserButton 
                  afterSignOutUrl="/login"
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8",
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 border-r border-gray-100 bg-white">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
            <NavContent />
          </div>
          
          {/* User profile section */}
          {user && (
            <div className="flex-shrink-0 flex justify-center border-t border-gray-100 p-4">
              <UserButton 
                afterSignOutUrl="/login"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8",
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
