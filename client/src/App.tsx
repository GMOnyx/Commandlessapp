import { Switch, Route, Redirect } from "wouter";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import CommandMappings from "@/pages/CommandMappings";
import CommandMappingDetail from "@/pages/CommandMappingDetail";
import BotConnections from "@/pages/BotConnections";
import NotFound from "@/pages/not-found";
import AuthProvider from "@/components/AuthProvider";
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState, useCallback } from "react";
import { setAuthTokenGetter } from "@/lib/queryClient";

function App() {
  console.log('=== APP FUNCTION CALLED ===');
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  console.log('=== APPCONTENT FUNCTION CALLED ===');
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const [authReady, setAuthReady] = useState(false);

  console.log('App render:', { isLoaded, isSignedIn, userId });

  // Create a stable token getter function
  const tokenGetter = useCallback(async () => {
    try {
      console.log('tokenGetter called:', { isSignedIn });
      if (!isSignedIn) {
        console.log('Not signed in, returning null token');
        return null;
      }
      const token = await getToken();
      console.log('Got token for API request:', token ? `Token exists (${token.substring(0, 20)}...)` : 'No token returned');
      return token;
    } catch (error) {
      console.error('Failed to get Clerk token:', error);
      return null;
    }
  }, [isSignedIn, getToken]);

  // Set up the token getter and mark auth as ready
  useEffect(() => {
    console.log('useEffect triggered:', { isLoaded, isSignedIn, userId });
    if (isLoaded) {
      console.log('Setting up auth token getter', { isSignedIn, userId });
      setAuthTokenGetter(tokenGetter);
      setAuthReady(true);
      console.log('Auth setup complete');
    }
  }, [isLoaded, isSignedIn, tokenGetter, userId]);

  console.log('App state:', { isLoaded, authReady, isSignedIn });

  // Show loading spinner while Clerk initializes
  if (!isLoaded || !authReady) {
    console.log('Showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login/signup when not authenticated
  if (!isSignedIn) {
    console.log('Showing login/signup');
    return (
      <Switch>
        <Route path="/sign-up">
          <SignUp />
        </Route>
        <Route path="/sign-in">
          <Login />
        </Route>
        <Route>
          <Redirect to="/sign-in" />
        </Route>
      </Switch>
    );
  }

  // Show main app when authenticated
  console.log('Showing main app');
  
  try {
    return (
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/mappings" component={CommandMappings} />
          <Route path="/mappings/:id" component={CommandMappingDetail} />
          <Route path="/connections" component={BotConnections} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    );
  } catch (error) {
    console.error('Error rendering main app:', error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">
          <h1>Error loading app</h1>
          <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }
}

export default App;
