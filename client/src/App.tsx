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
import WorkoutSummary from "@/pages/workout-summary";
import WorkoutLogging from "@/pages/workout-logging";
import WorkoutDashboard from "@/pages/workout-dashboard";
import NotFound from "@/pages/not-found";
import ShareEmbed from "@/pages/share";
import RegisterCoachPage from "@/pages/register-coach";
import AdminCoachesPage from "@/pages/admin-coaches";
import AdminCoachDetailPage from "@/pages/admin-coach-detail";
import AdminOverviewPage from "@/pages/admin-overview";

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

  return (
    <Switch>
      {/* Root route: show login when unauthenticated, otherwise role-based home */}
      <Route path="/">
        {!user ? (
          <LoginPage onLogin={handleLogin} />
        ) : user.role === 'admin' ? (
          <AdminOverviewPage user={user} onLogout={handleLogout} />
        ) : user.role === 'coach' ? (
          <CoachDashboard user={user} onLogout={handleLogout} />
        ) : (
          <ClientPortal user={user} onLogout={handleLogout} />
        )}
      </Route>

      {/* Public, unauthenticated share route */}
      <Route path="/share">
        <ShareEmbed />
      </Route>

      {/* Public: Register as Coach */}
      <Route path="/register-coach">
        <RegisterCoachPage />
      </Route>

      {/* Workout logging route - requires authentication */}
      <Route path="/workout-logging">
        {!user ? (
          <LoginPage onLogin={handleLogin} />
        ) : (
          <WorkoutLogging user={user} />
        )}
      </Route>

      {/* Workout summary route - requires authentication */}
      <Route path="/workout-summary">
        {!user ? (
          <LoginPage onLogin={handleLogin} />
        ) : (
          <WorkoutSummary user={user} />
        )}
      </Route>

      {/* Workout dashboard route - requires authentication */}
      <Route path="/workout-dashboard">
        {!user ? (
          <LoginPage onLogin={handleLogin} />
        ) : (
          <WorkoutDashboard user={user} />
        )}
      </Route>

      {/* Admin overview */}
      <Route path="/admin">
        {!user ? (
          <LoginPage onLogin={handleLogin} />
        ) : user.role !== 'admin' ? (
          <NotFound />
        ) : (
          <AdminOverviewPage user={user} onLogout={handleLogout} />
        )}
      </Route>

      {/* Admin routes */}
      <Route path="/admin/coaches">
        {!user ? (
          <LoginPage onLogin={handleLogin} />
        ) : user.role !== 'admin' ? (
          <NotFound />
        ) : (
          <AdminCoachesPage user={user} onLogout={handleLogout} />
        )}
      </Route>
      <Route path="/admin/coaches/:id">
        {!user ? (
          <LoginPage onLogin={handleLogin} />
        ) : user.role !== 'admin' ? (
          <NotFound />
        ) : (
          <AdminCoachDetailPage user={user} onLogout={handleLogout} />
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
