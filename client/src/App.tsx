import { useState } from "react";
import { Switch, Route } from "wouter";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import CommandMappings from "@/pages/CommandMappings";
import BotConnections from "@/pages/BotConnections";
import NotFound from "@/pages/not-found";

// Mock user for demo purposes
const demoUser = {
  id: 1,
  username: "demo",
  password: "password123",
  name: "Sarah Johnson",
  email: "sarah@example.com",
  role: "Marketing Lead",
  avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
};

function App() {
  // In a real app, this would be managed by a proper auth system
  const [user] = useState(demoUser);
  
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Main routes */}
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
