import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Debug logging
console.log('🔍 Environment Debug:', {
  key: PUBLISHABLE_KEY ? `${PUBLISHABLE_KEY.substring(0, 20)}...` : 'MISSING',
  keyLength: PUBLISHABLE_KEY?.length || 0,
  startsWithPk: PUBLISHABLE_KEY?.startsWith('pk_') || false,
  hostname: window.location.hostname,
  allEnvVars: Object.keys(import.meta.env).filter(key => key.includes('CLERK'))
});

if (!PUBLISHABLE_KEY) {
  const errorMessage = `❌ Missing Clerk Publishable Key!
  
Environment Variables Found: ${Object.keys(import.meta.env).join(', ')}
Clerk Variables: ${Object.keys(import.meta.env).filter(key => key.includes('CLERK')).join(', ') || 'NONE'}

Please check your Vercel environment variables:
1. Go to Vercel Dashboard
2. Project Settings > Environment Variables  
3. Ensure VITE_CLERK_PUBLISHABLE_KEY is set
4. Should start with 'pk_test_' or 'pk_live_'`;
  
  console.error(errorMessage);
  
  // Show error in UI instead of throwing
  document.body.innerHTML = `<div style="padding: 20px; font-family: monospace; background: #fee; border: 1px solid #f00; margin: 20px;">
    <h2>🚨 Configuration Error</h2>
    <pre>${errorMessage}</pre>
  </div>`;
  
  throw new Error("Missing Clerk Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <App />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>
);
