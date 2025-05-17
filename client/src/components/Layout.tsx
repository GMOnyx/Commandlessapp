import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import Sidebar from "@/components/ui/sidebar";
import TopBar from "@/components/TopBar";
import { User } from "@shared/schema";

interface LayoutProps {
  children: ReactNode;
}

// Demo user for Commandless platform
const demoUser: User = {
  id: 1,
  username: "demo",
  password: "password123",
  name: "Demo User",
  email: "demo@example.com",
  role: "Admin",
  avatar: null
};

export default function Layout({ children }: LayoutProps) {
  const [, navigate] = useLocation();
  
  // Check if user is logged in
  useEffect(() => {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    if (!isLoggedIn) {
      navigate("/login");
    }
  }, [navigate]);
  
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar user={demoUser} />
      
      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Navigation */}
        <TopBar />
        
        {/* Page Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
