import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { authStorage } from "@/lib/auth";
import { AuthUser } from "@/lib/types";
import LoginPage from "@/pages/login";
import CoachDashboard from "@/pages/coach-dashboard";
import ClientPortal from "@/pages/client-portal";
import NotFound from "@/pages/not-found";

function Router() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const storedUser = authStorage.getUser();
    const token = authStorage.getToken();
    
    // Validate token format (basic check)
    if (storedUser && token && token.split('.').length === 3) {
      setUser(storedUser);
    } else {
      // Clear corrupted auth data
      authStorage.clear();
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (newUser: AuthUser) => {
    setUser(newUser);
  };

  const handleLogout = () => {
    authStorage.clear();
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-thrst-green"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Switch>
      <Route path="/">
        {user.role === 'coach' ? (
          <CoachDashboard user={user} onLogout={handleLogout} />
        ) : (
          <ClientPortal user={user} onLogout={handleLogout} />
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="thrst-ui-theme">
        <TooltipProvider>
          <div className="min-h-screen">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
