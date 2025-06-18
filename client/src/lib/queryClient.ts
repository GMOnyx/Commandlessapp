import { QueryClient } from "@tanstack/react-query";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Global token getter - will be set by the App component
let globalTokenGetter: (() => Promise<string | null>) | null = null;

// Dynamic API base URL configuration
function getApiBaseUrl(): string {
  // FORCE: Always use the working Vercel deployment URL with proper API endpoints
  // This ensures we hit the Vercel serverless functions that support PUT/DELETE
  const WORKING_VERCEL_URL = 'https://commandlessapp-grm435w11-abdarrahmans-projects.vercel.app';
  
  console.log('🔗 API Base URL (FORCED TO VERCEL):', WORKING_VERCEL_URL);
  return WORKING_VERCEL_URL;
}

const API_BASE_URL = getApiBaseUrl();

export { API_BASE_URL };

// Enhanced logging function for debugging
function logDetailed(category: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    category,
    message,
    url: typeof window !== 'undefined' ? window.location.href : 'N/A',
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'N/A',
    ...data
  };
  
  console.log(`🔍 [${category}] ${message}`, logData);
}

// API request function that includes authentication
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  // Use current origin (Vercel) instead of hardcoded Railway URL
  const baseUrl = API_BASE_URL;
  
  const url = `${baseUrl}${endpoint}`;
  
  logDetailed('API_REQUEST', 'Starting API request', {
    endpoint,
    baseUrl,
    fullUrl: url,
    method: options.method || 'GET',
    hasBody: !!options.body,
    headers: options.headers
  });

  // Get authentication token
  let token: string | null = null;
  if (globalTokenGetter) {
    try {
      token = await globalTokenGetter();
      logDetailed('AUTH_TOKEN', 'Token retrieved', { 
        hasToken: !!token,
        tokenLength: token?.length || 0
      });
    } catch (error) {
      logDetailed('AUTH_ERROR', 'Failed to get token', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  logDetailed('API_REQUEST', 'Making fetch request', {
    url,
    method: config.method || 'GET',
    hasToken: !!token,
    headers: Object.keys(config.headers || {}),
    authHeaderPresent: !!(config.headers as any)?.Authorization
  });

  try {
    const response = await fetch(url, config);
    
    logDetailed('API_RESPONSE', 'Received response', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      logDetailed('API_ERROR', 'HTTP error response', {
        url,
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(`${response.status}: ${errorMessage}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      logDetailed('API_SUCCESS', 'Request completed successfully', {
        url,
        status: response.status,
        dataType: typeof data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : 'N/A'
      });
      return data;
    }
    
    return response.text();
  } catch (error) {
    logDetailed('API_ERROR', 'Fetch failed', {
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof TypeError ? 'TypeError' : error instanceof Error ? error.constructor.name : 'Unknown'
    });
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

// Function to set auth token getter - called by App component
export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  console.log('🔧 setAuthTokenGetter called - token getter is now available!');
  globalTokenGetter = getter;
  
  // Test the token getter immediately
  setTimeout(async () => {
    try {
      console.log('🧪 Testing token getter...');
      const testToken = await getter();
      console.log('🧪 Token getter test result:', {
        hasToken: !!testToken,
        tokenLength: testToken?.length || 0
      });
    } catch (error) {
      console.error('🧪 Token getter test failed:', error);
    }
  }, 1000);
}

// Alternative API request for use outside React components
export async function apiRequestWithToken(endpoint: string, token: string | null, options: RequestInit = {}) {
  // Use current origin (Vercel) instead of hardcoded Railway URL
  const baseUrl = API_BASE_URL;
  
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

// Version: Fixed API routing to use Vercel endpoints - 2025-01-25

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
