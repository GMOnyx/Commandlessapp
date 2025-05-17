import { Switch, Route } from "wouter";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import CommandMappings from "@/pages/CommandMappings";
import BotConnections from "@/pages/BotConnections";
import NotFound from "@/pages/not-found";

function App() {
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
