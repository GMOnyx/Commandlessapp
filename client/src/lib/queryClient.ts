import { QueryClient } from "@tanstack/react-query";

// API request function that includes authentication
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  // Determine base URL based on environment - hardcode production URL
  let baseUrl: string;
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    console.log('🌍 Hostname detected:', hostname);
    console.log('🌍 Full location:', window.location.href);
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      baseUrl = 'http://localhost:5001';
    } else if (hostname === 'www.commandless.app' || hostname === 'commandless.app') {
      baseUrl = 'https://www.commandless.app';
    } else if (hostname.includes('commandless')) {
      // Force correct domain for any commandless-related hostname
      baseUrl = 'https://www.commandless.app';
    } else {
      // For any other domain, use the current origin
      baseUrl = window.location.origin;
    }
  } else {
    // Fallback for server-side rendering
    baseUrl = 'http://localhost:5001';
  }
  
  const url = `${baseUrl}${endpoint}`;

  // Get the auth token directly from Clerk
  let token: string | null = null;
  
  console.log('🔍 apiRequest called for:', endpoint);
  console.log('🌐 Base URL:', baseUrl);
  console.log('🔗 Full URL:', url);
  
  // Try to get token from Clerk directly
  try {
    // Check if Clerk is available on window (it should be after Clerk loads)
    const clerk = (window as any)?.Clerk;
    
    if (clerk && clerk.session) {
      token = await clerk.session.getToken();
      console.log('🔑 Got token from Clerk session:', token ? 'Token exists' : 'No token');
    } else {
      console.log('❌ No Clerk session available');
    }
  } catch (error) {
    console.error("Failed to get auth token from Clerk:", error);
  }

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  console.log(`Making API request to ${endpoint}`, { hasToken: !!token, config });

  try {
    const response = await fetch(url, config);
    console.log(`📡 Fetch response for ${endpoint}:`, { 
      status: response.status, 
      ok: response.ok,
      statusText: response.statusText 
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ API response from ${endpoint}:`, data);
    return data;
  } catch (error) {
    console.error(`💥 Fetch failed for ${endpoint}:`, error);
    throw error;
  }
}

// Default query function for React Query
const defaultQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const [url] = queryKey as [string];
  return apiRequest(url);
};

// Create the query client with our custom default query function
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Legacy function to set auth token getter (now unused but kept for compatibility)
export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  console.log('🔧 setAuthTokenGetter called (legacy - now using Clerk directly)');
}

// Alternative API request for use outside React components
export async function apiRequestWithToken(endpoint: string, token: string | null, options: RequestInit = {}) {
  // Use the same logic as apiRequest for consistent behavior - hardcode production URL
  let baseUrl: string;
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      baseUrl = 'http://localhost:5001';
    } else if (hostname === 'www.commandless.app' || hostname === 'commandless.app') {
      baseUrl = 'https://www.commandless.app';
    } else {
      // For any other domain (like vercel preview URLs), use the current origin
      baseUrl = window.location.origin;
    }
  } else {
    // Fallback for server-side rendering
    baseUrl = 'http://localhost:5001';
  }
  
  const url = `${baseUrl}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}
