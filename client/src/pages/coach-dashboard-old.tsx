import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { GlassCard } from "@/components/ui/glass-card";
import { useTheme } from "@/components/ui/theme-provider";
import { getAuthHeaders } from "@/lib/auth";
import { CoachStats, ClientData, AuthUser } from "@/lib/types";
import ClientManagement from "./client-management";
import WorkoutManagement from "./workout-management";
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
  Clock,
  BarChart3,
  Settings
} from "lucide-react";

interface CoachDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function CoachDashboard({ user, onLogout }: CoachDashboardProps) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");

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

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="glass-morphism border-b border-white/10 px-4">
          <TabsList className="bg-transparent h-12 w-full justify-start">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-thrst-green/20 data-[state=active]:text-thrst-green"
              data-testid="tab-overview"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="clients" 
              className="data-[state=active]:bg-thrst-green/20 data-[state=active]:text-thrst-green"
              data-testid="tab-clients"
            >
              <Users className="h-4 w-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger 
              value="workouts" 
              className="data-[state=active]:bg-thrst-green/20 data-[state=active]:text-thrst-green"
              data-testid="tab-workouts"
            >
              <Dumbbell className="h-4 w-4 mr-2" />
              Workouts
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="data-[state=active]:bg-thrst-green/20 data-[state=active]:text-thrst-green"
              data-testid="tab-analytics"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-thrst-green/20 data-[state=active]:text-thrst-green"
              data-testid="tab-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="p-4 space-y-6">
          {/* Compact Stats */}
          <div className="grid grid-cols-4 gap-2">
            <GlassCard className="p-3">
              <div className="text-center">
                <div className="text-lg font-bold text-thrst-green" data-testid="text-total-clients">
                  {stats?.totalClients || 0}
                </div>
                <div className="text-xs text-muted-foreground">Clients</div>
              </div>
            </GlassCard>
            
            <GlassCard className="p-3">
              <div className="text-center">
                <div className="text-lg font-bold text-thrst-accent" data-testid="text-avg-progress">
                  {stats?.avgProgress || 0}%
                </div>
                <div className="text-xs text-muted-foreground">Progress</div>
              </div>
            </GlassCard>

            <GlassCard className="p-3">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-400" data-testid="text-completed-workouts">
                  {stats?.completedWorkouts || 0}
                </div>
                <div className="text-xs text-muted-foreground">Workouts</div>
              </div>
            </GlassCard>

            <GlassCard className="p-3">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-400" data-testid="text-active-clients">
                  {stats?.activeClients || 0}
                </div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </GlassCard>
          </div>

          {/* Clients to Train Today */}
          <GlassCard>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-thrst-green" />
                Today's Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {clients?.filter(client => {
                return client.isActive;
              }).slice(0, 3).map((client) => (
                <div key={client.id} className="flex items-center justify-between p-3 glass-morphism rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 thrst-gradient rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {client.user?.firstName?.charAt(0) || 'C'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {client.user?.firstName || 'Client'} {client.user?.lastName || ''}
                      </p>
                      <p className="text-xs text-muted-foreground">Next: Chest & Back</p>
                    </div>
                  </div>
                  <Button size="sm" className="bg-thrst-green/20 hover:bg-thrst-green/30 text-thrst-green">
                    Start
                  </Button>
                </div>
              )) || (
                <p className="text-center text-muted-foreground py-4">No sessions scheduled for today</p>
              )}
            </CardContent>
          </GlassCard>
        </TabsContent>

        <TabsContent value="clients">
          <ClientManagement user={user} />
        </TabsContent>

        <TabsContent value="workouts">
          <WorkoutManagement user={user} />
        </TabsContent>

        <TabsContent value="analytics" className="p-4">
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analytics Coming Soon</h3>
            <p className="text-muted-foreground">Detailed progress reports and insights</p>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="p-4">
          <div className="text-center py-12">
            <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Settings</h3>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
        </TabsContent>
      </Tabs>

      </Tabs>
    </div>
  );
}
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
