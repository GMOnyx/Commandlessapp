import { 
  HelpCircleIcon, 
  MenuIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/clerk-react";

interface TopBarProps {
  onMobileMenuClick?: () => void;
}

export default function TopBar({ onMobileMenuClick }: TopBarProps) {
  const handleHelpClick = () => {
    window.open('https://commandless.vercel.app', '_blank');
  };

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white border-b border-gray-100 shadow-sm">
      <button 
        type="button" 
        className="md:hidden px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-colors hover:bg-gray-50"
        onClick={onMobileMenuClick}
      >
        <span className="sr-only">Open sidebar</span>
        <MenuIcon className="h-6 w-6" />
      </button>
      
      <div className="flex-1 px-4 flex justify-end">
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* Help Menu */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full hover:bg-gray-100"
            onClick={handleHelpClick}
          >
            <span className="sr-only">Help center</span>
            <HelpCircleIcon className="h-5 w-5" />
          </Button>
          
          {/* Clerk User Button with logout functionality */}
          <UserButton 
            afterSignOutUrl="/login"
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
