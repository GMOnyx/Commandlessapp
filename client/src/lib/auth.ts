import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, LoginUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "./queryClient";

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginUser) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginUser) => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      const data = await response.json();
      
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      
      setUser(data.user);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive"
      });
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const contextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function withAuth(Component: React.ComponentType) {
  return function WithAuth(props: any) {
    return (
      <AuthProvider>
        <Component {...props} />
      </AuthProvider>
    );
  };
}