import { Switch, Route, Redirect } from "wouter";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import Landing from "@/pages/Landing";
import CommandMappings from "@/pages/CommandMappings";
import CommandMappingDetail from "@/pages/CommandMappingDetail";
import BotConnections from "@/pages/BotConnections";
import BotConfiguration from "@/pages/BotConfiguration";
import SDKPage from "@/pages/SDK";
import APIKeysPage from "@/pages/APIKeys";
import PricingPage from "@/pages/Pricing";
import NotFound from "@/pages/not-found";
import AuthProvider from "@/components/AuthProvider";
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState, useCallback } from "react";
import { setAuthTokenGetter } from "@/lib/queryClient";

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a stable token getter function
  const tokenGetter = useCallback(async () => {
    try {
      if (!isSignedIn) {
        return null;
      }
      const token = await getToken();
      return token;
    } catch (error) {
      console.error('Failed to get Clerk token:', error);
      setError('Failed to authenticate. Please try refreshing the page.');
      return null;
    }
  }, [isSignedIn, getToken]);

  // Set up the token getter and mark auth as ready
  useEffect(() => {
    if (isLoaded) {
      setAuthTokenGetter(tokenGetter);
      setAuthReady(true);
    }
  }, [isLoaded, isSignedIn, tokenGetter]);

  // Debug information for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Clerk Debug Info:', {
        isLoaded,
        isSignedIn,
        authReady,
        clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 20) + '...'
      });
    }
  }, [isLoaded, isSignedIn, authReady]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Show loading spinner while Clerk initializes
  if (!isLoaded || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show auth routes and default to sign-in
  if (!isSignedIn) {
    return (
      <Switch>
        <Route path="/">
          <Landing />
        </Route>
        <Route path="/sign-up">
          <SignUp />
        </Route>
        <Route path="/sign-in">
          <Login />
        </Route>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  // Show main app when authenticated
  return (
    <Layout>
      <Switch>
        <Route path="/sign-in">
          <Redirect to="/dashboard" />
        </Route>
        <Route path="/sign-up">
          <Redirect to="/dashboard" />
        </Route>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/mappings" component={CommandMappings} />
        <Route path="/mappings/:id" component={CommandMappingDetail} />
        <Route path="/connections" component={BotConnections} />
        <Route path="/bots/:id/config" component={BotConfiguration} />
        <Route path="/sdk" component={SDKPage} />
        <Route path="/api-keys" component={APIKeysPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default App;
