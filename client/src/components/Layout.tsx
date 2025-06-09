import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/clerk-react";
import Sidebar from "@/components/ui/sidebar";
import TopBar from "@/components/TopBar";
import { User } from "@shared/schema";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user: clerkUser, isLoaded } = useUser();
  
  // Check if user is authenticated with Clerk
  useEffect(() => {
    if (isLoaded && !clerkUser) {
      navigate("/login");
    }
  }, [clerkUser, isLoaded, navigate]);

  const handleMobileMenuClick = () => {
    setMobileMenuOpen(true);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };
  
  // Convert Clerk user to our User format for the sidebar
  const sidebarUser: User | null = clerkUser ? {
    id: clerkUser.id,
    username: clerkUser.username || clerkUser.emailAddresses[0]?.emailAddress.split('@')[0] || "user",
    password: "", // Not needed for display
    name: clerkUser.fullName || 
          (clerkUser.firstName && clerkUser.lastName ? `${clerkUser.firstName} ${clerkUser.lastName}` : null) ||
          clerkUser.firstName ||
          clerkUser.lastName ||
          clerkUser.username ||
          clerkUser.emailAddresses[0]?.emailAddress.split('@')[0] ||
          "User",
    email: clerkUser.emailAddresses[0]?.emailAddress || null,
    role: "User", // Default role, could be enhanced with custom claims
    avatar: clerkUser.imageUrl || null
  } : null;
  
  // Debug log to see user data (can be removed later)
  if (clerkUser && process.env.NODE_ENV === 'development') {
    console.log('Clerk User Data:', {
      fullName: clerkUser.fullName,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      username: clerkUser.username,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      finalDisplayName: sidebarUser?.name
    });
  }
  
  // Don't render anything until Clerk has loaded
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar with mobile menu support */}
      <Sidebar 
        user={sidebarUser} 
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClose={handleMobileMenuClose}
      />
      
      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Navigation */}
        <TopBar onMobileMenuClick={handleMobileMenuClick} />
        
        {/* Page Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-4 md:py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
