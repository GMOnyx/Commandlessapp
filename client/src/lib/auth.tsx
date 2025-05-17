import { createContext, useContext, useState, ReactNode } from "react";
import { LoginUser, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// For demo purposes
const demoUser: User = {
  id: 1,
  username: "demo", 
  password: "password123",
  name: "Demo User",
  email: "demo@example.com",
  role: "Admin",
  avatar: null
};

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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const login = async (credentials: LoginUser): Promise<boolean> => {
    setIsLoading(true);
    
    // Simple demo login - in production we'd call the API
    if (credentials.username === "demo" && credentials.password === "password123") {
      setTimeout(() => {
        setUser(demoUser);
        setIsLoading(false);
      }, 500);
      return true;
    } else {
      setIsLoading(false);
      toast({
        title: "Login failed",
        description: "Invalid credentials. Use demo/password123",
        variant: "destructive",
      });
      return false;
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider 
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout
      }}
    >
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