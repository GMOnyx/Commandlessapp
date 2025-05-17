import { Switch, Route, useLocation } from "wouter";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import CommandMappings from "@/pages/CommandMappings";
import BotConnections from "@/pages/BotConnections";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/lib/auth";
import Onboarding from "@/pages/Onboarding";
import Training from "@/pages/Training";
import TeamCollaboration from "@/pages/TeamCollaboration";

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  
  // If auth is still loading, don't render anything
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated && location !== "/login") {
    setLocation("/login");
    return null;
  }
  
  // Redirect to dashboard if authenticated and trying to access login
  if (isAuthenticated && location === "/login") {
    setLocation("/");
    return null;
  }
  
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected routes */}
      <Route path="/">
        <Layout>
          <Dashboard />
        </Layout>
      </Route>
      
      <Route path="/mappings">
        <Layout>
          <CommandMappings />
        </Layout>
      </Route>
      
      <Route path="/connections">
        <Layout>
          <BotConnections />
        </Layout>
      </Route>
      
      {/* Employee Onboarding and Training routes */}
      <Route path="/onboarding">
        <Layout>
          <Onboarding />
        </Layout>
      </Route>
      
      <Route path="/training">
        <Layout>
          <Training />
        </Layout>
      </Route>
      
      <Route path="/team-collaboration">
        <Layout>
          <TeamCollaboration />
        </Layout>
      </Route>
      
      {/* Fallback to 404 */}
      <Route>
        <Layout>
          <NotFound />
        </Layout>
      </Route>
    </Switch>
  );
}

export default App;
