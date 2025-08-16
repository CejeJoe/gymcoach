import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { GlassCard } from "@/components/ui/glass-card";
import { useTheme } from "@/components/ui/theme-provider";
import { getAuthHeaders } from "@/lib/auth";
import { CoachStats, ClientData, AuthUser } from "@/lib/types";
import { 
  Users, 
  TrendingUp, 
  Calendar, 
  UserPlus, 
  Moon, 
  Sun, 
  LogOut,
  Dumbbell,
  Target,
  Clock
} from "lucide-react";

interface CoachDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function CoachDashboard({ user, onLogout }: CoachDashboardProps) {
  const { theme, setTheme } = useTheme();

  const { data: stats, isLoading: statsLoading } = useQuery<CoachStats>({
    queryKey: ['/api/coach/stats'],
    queryFn: async () => {
      const response = await fetch('/api/coach/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const { data: clients, isLoading: clientsLoading } = useQuery<ClientData[]>({
    queryKey: ['/api/coach/clients'],
    queryFn: async () => {
      const response = await fetch('/api/coach/clients', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
  });

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (statsLoading || clientsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-thrst-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass-morphism sticky top-0 z-40 p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 thrst-gradient rounded-xl flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Coach Dashboard</h1>
              <p className="text-xs text-muted-foreground">Welcome back, {user.firstName}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="glass-morphism rounded-xl"
              data-testid="button-theme-toggle"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="bg-thrst-accent/20 rounded-xl hover:bg-thrst-accent/30"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 text-thrst-accent" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard gradient>
            <div className="text-center">
              <div className="text-2xl font-bold text-thrst-green" data-testid="text-total-clients">
                {stats?.totalClients || 0}
              </div>
              <div className="text-sm text-muted-foreground">Active Clients</div>
            </div>
          </GlassCard>
          
          <GlassCard gradient>
            <div className="text-center">
              <div className="text-2xl font-bold text-thrst-accent" data-testid="text-avg-progress">
                {stats?.avgProgress || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Progress</div>
            </div>
          </GlassCard>
        </div>

        {/* Quick Actions */}
        <GlassCard>
          <h3 className="font-semibold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline"
              className="h-16 flex-col space-y-2 bg-thrst-green/10 border-thrst-green/30 hover:bg-thrst-green/20"
              data-testid="button-add-client"
            >
              <UserPlus className="h-5 w-5 text-thrst-green" />
              <span className="text-sm font-medium">Add Client</span>
            </Button>
            
            <Button 
              variant="outline"
              className="h-16 flex-col space-y-2 bg-thrst-accent/10 border-thrst-accent/30 hover:bg-thrst-accent/20"
              data-testid="button-schedule"
            >
              <Calendar className="h-5 w-5 text-thrst-accent" />
              <span className="text-sm font-medium">Schedule</span>
            </Button>
          </div>
        </GlassCard>

        {/* Recent Clients */}
        <div className="space-y-3">
          <h3 className="font-semibold">Recent Clients</h3>
          
          {clients && clients.length > 0 ? (
            clients.slice(0, 5).map((client) => (
              <GlassCard key={client.id} gradient>
                <div className="flex items-center space-x-3">
                  <img 
                    src={client.user?.avatar || `https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150`}
                    alt="Client profile" 
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium" data-testid={`text-client-name-${client.id}`}>
                      {client.user?.firstName} {client.user?.lastName}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Last session: 2 hours ago
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-thrst-green font-semibold" data-testid={`text-client-progress-${client.id}`}>
                      {Math.floor(Math.random() * 30) + 70}%
                    </div>
                    <div className="text-xs text-muted-foreground">Progress</div>
                  </div>
                </div>
              </GlassCard>
            ))
          ) : (
            <GlassCard>
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No clients yet</p>
                <p className="text-sm text-muted-foreground">Add your first client to get started</p>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Performance Overview */}
        <GlassCard>
          <h3 className="font-semibold mb-4">This Week's Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-thrst-green" />
                <span className="text-sm">Goals Achieved</span>
              </div>
              <Badge variant="secondary" className="bg-thrst-green/10 text-thrst-green">
                18/24
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-thrst-accent" />
                <span className="text-sm">Training Hours</span>
              </div>
              <Badge variant="secondary" className="bg-thrst-accent/10 text-thrst-accent">
                32h
              </Badge>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton data-testid="floating-add-button" />

      {/* Bottom Navigation */}
      <nav className="glass-morphism fixed bottom-0 left-0 right-0 p-4 border-t border-white/10">
        <div className="flex justify-around">
          <button className="flex flex-col items-center space-y-1 text-thrst-green" data-testid="nav-dashboard">
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Dashboard</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-muted-foreground" data-testid="nav-clients">
            <Users className="h-5 w-5" />
            <span className="text-xs">Clients</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-muted-foreground" data-testid="nav-analytics">
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Analytics</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-muted-foreground" data-testid="nav-settings">
            <Calendar className="h-5 w-5" />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
