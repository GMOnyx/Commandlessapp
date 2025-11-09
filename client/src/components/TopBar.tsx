import { 
  HelpCircleIcon, 
  MenuIcon,
  CreditCardIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/clerk-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface TopBarProps {
  onMobileMenuClick?: () => void;
}

export default function TopBar({ onMobileMenuClick }: TopBarProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleHelpClick = () => {
    window.open('https://commandless.vercel.app', '_blank');
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("/api/billing/portal", {
        method: "POST",
      });

      if (response.url) {
        window.location.href = response.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: any) {
      console.error("Billing portal error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal. You may not have an active subscription.",
        variant: "destructive",
      });
      setLoading(false);
    }
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
      
      <div className="flex-1 px-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/pricing")}
            className="text-sm"
          >
            Pricing
          </Button>
        </div>
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* Manage Billing */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleManageBilling}
            disabled={loading}
            className="text-sm"
          >
            <CreditCardIcon className="h-4 w-4 mr-1" />
            {loading ? "Loading..." : "Billing"}
          </Button>
          
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
