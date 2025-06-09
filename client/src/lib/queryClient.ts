import { QueryClient } from "@tanstack/react-query";

// API request function that includes authentication
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
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
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
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
