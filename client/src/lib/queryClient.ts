import { QueryClient } from "@tanstack/react-query";

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
  
  // Also try to send to our logging endpoint (non-blocking)
  if (typeof window !== 'undefined') {
    const railwayLogUrl = 'https://commandlessapp-production.up.railway.app/api/client-logs';
    try {
      fetch(railwayLogUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      }).catch(() => {
        // Ignore errors - logging is best effort
      });
    } catch (e) {
      // Ignore - logging is best effort
    }
  }
}

// API request function that includes authentication
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  // Use environment variable for API URL, fallback to localhost for development
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  
  const url = `${baseUrl}${endpoint}`;
  
  logDetailed('API_REQUEST', 'Starting API request', {
    endpoint,
    baseUrl,
    fullUrl: url,
    method: options.method || 'GET',
    hasBody: !!(options.body)
  });

  // Get the auth token directly from Clerk
  let token: string | null = null;
  
  // Try to get token from Clerk directly
  try {
    // Check if Clerk is available on window (it should be after Clerk loads)
    const clerk = (window as any)?.Clerk;
    
    if (clerk && clerk.session) {
      token = await clerk.session.getToken();
      logDetailed('AUTH', 'Token retrieved from Clerk', { 
        hasToken: !!token, 
        tokenLength: token?.length || 0,
        clerkSessionExists: !!clerk.session
      });
    } else {
      logDetailed('AUTH', 'No Clerk session available', { 
        hasClerk: !!clerk,
        hasSession: !!(clerk?.session)
      });
    }
  } catch (error) {
    logDetailed('AUTH', 'Failed to get auth token from Clerk', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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
    headers: Object.keys(config.headers || {})
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
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    logDetailed('API_SUCCESS', 'Request completed successfully', {
      url,
      status: response.status,
      dataType: typeof data,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : 'N/A'
    });
    
    return data;
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

// Legacy function to set auth token getter (now unused but kept for compatibility)
export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  console.log('🔧 setAuthTokenGetter called (legacy - now using Clerk directly)');
}

// Alternative API request for use outside React components
export async function apiRequestWithToken(endpoint: string, token: string | null, options: RequestInit = {}) {
  // Use environment variable for API URL, fallback to localhost for development
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
