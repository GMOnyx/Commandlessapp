import { useState } from "react";
import { Switch, Route } from "wouter";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import CommandMappings from "@/pages/CommandMappings";
import BotConnections from "@/pages/BotConnections";
import NotFound from "@/pages/not-found";
import { User } from "@shared/schema";

// Demo user for Commandless platform
const demoUser: User = {
  id: 1,
  username: "demo",
  password: "password123",
  name: "Demo User",
  email: "demo@example.com",
  role: "Admin",
  avatar: null
};

function App() {
  // Simple auth state management - would be more robust in production
  const [user] = useState<User>(demoUser);
  
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Main routes for Commandless platform */}
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
