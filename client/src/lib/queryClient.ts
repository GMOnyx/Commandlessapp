import { QueryClient } from "@tanstack/react-query";

// Get auth token from Clerk
async function getAuthToken(): Promise<string | null> {
  try {
    // Check if Clerk is available on window
    const clerk = (window as any)?.Clerk;
    
    if (clerk && clerk.session) {
      const token = await clerk.session.getToken();
      return token;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to get auth token from Clerk:", error);
    return null;
  }
}

// New universal base-URL resolver
function getApiBaseUrl(endpoint?: string): string {
  // 1. If a build-time env var is set (e.g. VITE_API_BASE_URL) use it
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  
  // 2. Default to Vercel for all operations
  return window.location.origin;
}

export const API_BASE_URL = getApiBaseUrl();

// API request function that includes authentication
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getAuthToken();
  
  // Build the full URL
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  // Debug logging for command mapping requests
  if (endpoint.includes('/mappings/')) {
    console.log('🔍 API Request Debug:', {
      endpoint,
      fullUrl,
      API_BASE_URL,
      hasToken: !!token,
      tokenLength: token?.length,
      options
    });
  }
  
  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  // Debug logging for command mapping responses
  if (endpoint.includes('/mappings/')) {
    console.log('🔍 API Response Debug:', {
      endpoint,
      fullUrl,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // If we get HTML instead of JSON, log the response body
    if (response.headers.get('content-type')?.includes('text/html')) {
      const clonedResponse = response.clone();
      clonedResponse.text().then(html => {
        console.log('🔍 HTML Response (first 500 chars):', html.substring(0, 500));
      });
    }
  }

  if (!response.ok) {
    if (endpoint.includes('/mappings/')) {
      const errorText = await response.text();
      console.log('🔍 API Error Response:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response;
};

// Default query function for React Query
const defaultQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const [url] = queryKey as [string];
  
  // Convert dynamic route URLs to query parameter format for mappings
  let actualUrl = url;
  const mappingDetailMatch = url.match(/^\/api\/mappings\/(\d+)$/);
  if (mappingDetailMatch) {
    const mappingId = mappingDetailMatch[1];
    actualUrl = `/api/mappings?id=${mappingId}`;
    console.log('🔄 Converting dynamic route to query param:', { original: url, converted: actualUrl });
  }
  
  const response = await apiRequest(actualUrl);
  return response.json();
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
