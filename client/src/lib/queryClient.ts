import { QueryClient } from "@tanstack/react-query";

// New universal base-URL resolver
function getApiBaseUrl(): string {
  // 1. If a build-time env var is set (e.g. VITE_API_BASE_URL) use it
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  
  // 2. Else default to same-origin (works on Vercel prod / preview / localhost)
  return window.location.origin;
}

export const API_BASE_URL = getApiBaseUrl();

// API request function that includes authentication
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get the auth token directly from Clerk
  let token: string | null = null;
  
  console.log('🔍 apiRequest called for:', endpoint);
  
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

  console.log(`Making API request to ${endpoint}`, { hasToken: !!token });

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API Error ${response.status}:`, errorText);
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log(`API response from ${endpoint}:`, data);
  return data;
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
  const url = `${API_BASE_URL}${endpoint}`;

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
