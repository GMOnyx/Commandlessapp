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
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [authReady, setAuthReady] = useState(false);

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

  // Show loading spinner while Clerk initializes
  if (!isLoaded || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login/signup when not authenticated
  if (!isSignedIn) {
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
}

export default App;
