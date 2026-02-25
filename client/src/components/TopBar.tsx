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
        // If admin user, just show a message instead of redirecting
        if (response.message?.includes('Admin access')) {
          toast({
            title: "Admin Access",
            description: "You have unlimited free access. No billing management needed.",
            variant: "default",
          });
        } else if (response.mode === 'credits') {
          // User is on a free trial with credits; no portal to open
          toast({
            title: "Free trial active",
            description: response.message || "You are currently on a free trial. No billing management needed yet.",
            variant: "default",
          });
        } else {
          window.location.href = response.url;
        }
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: any) {
      console.error("Billing portal error:", error);
      
      // Parse error message - apiRequest throws "HTTP 404: {json}"
      let errorMsg = error.message || String(error) || '';
      let errorData: any = null;
      
      // Try to extract JSON from error message (format: "HTTP 404: {...}")
      try {
        const jsonMatch = errorMsg.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          errorData = JSON.parse(jsonMatch[0]);
          errorMsg = errorData.message || errorData.error || errorMsg;
        }
      } catch {
        // If parsing fails, use the raw message
      }
      
      const errorLower = errorMsg.toLowerCase();
      
      // If user doesn't have a Stripe customer yet, redirect to pricing
      if (errorLower.includes('no stripe customer') || 
          errorData?.code === 'NO_CUSTOMER' ||
          errorMsg.includes('404')) {
        toast({
          title: "No subscription found",
          description: "You need to subscribe to a plan first. Redirecting to pricing...",
          variant: "default",
        });
        setTimeout(() => {
          navigate("/pricing");
        }, 1500);
      } else {
        toast({
          title: "Error",
          description: errorMsg || "Failed to open billing portal. Please try again.",
          variant: "destructive",
        });
      }
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
