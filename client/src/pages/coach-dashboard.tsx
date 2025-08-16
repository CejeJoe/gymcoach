import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
                  <Button 
                    size="sm" 
                    className="bg-thrst-green/20 hover:bg-thrst-green/30 text-thrst-green"
                    onClick={() => setActiveTab('workouts')}
                  >
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

        <TabsContent value="analytics" className="p-4 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-4">Analytics Dashboard</h2>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <GlassCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-thrst-green/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-thrst-green" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client Growth</p>
                  <p className="text-xl font-bold">+{stats?.totalClients || 0}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-xl font-bold">{stats?.avgProgress || 0}%</p>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Progress Chart */}
          <GlassCard className="p-6">
            <h3 className="font-semibold mb-4">Monthly Progress</h3>
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Chart visualization</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Jan</span><span>8 clients</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Feb</span><span>12 clients</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Mar</span><span>{stats?.totalClients || 15} clients</span>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Recent Activity */}
          <GlassCard className="p-4">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Dumbbell className="h-4 w-4 text-thrst-green" />
                <span className="text-sm">New workout created</span>
                <span className="text-xs text-muted-foreground ml-auto">2h ago</span>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Client progress updated</span>
                <span className="text-xs text-muted-foreground ml-auto">5h ago</span>
              </div>
              <div className="flex items-center space-x-3">
                <Target className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Goal milestone reached</span>
                <span className="text-xs text-muted-foreground ml-auto">1d ago</span>
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="settings" className="p-4 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-4">Settings</h2>
          </div>

          <GlassCard className="p-4">
            <h3 className="font-semibold mb-4">Account Information</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <p className="text-sm text-muted-foreground">{user.firstName} {user.lastName}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <p className="text-sm text-muted-foreground">Coach</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <h3 className="font-semibold mb-4">Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Dark Mode</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Notifications</span>
                <Badge variant="secondary">Enabled</Badge>
              </div>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
      
      {/* Bottom Navigation */}
      <nav className="glass-morphism fixed bottom-0 left-0 right-0 p-2 border-t border-white/10">
        <div className="flex justify-around max-w-md mx-auto">
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'overview' ? 'text-thrst-green' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('overview')}
            data-testid="nav-overview"
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Overview</span>
          </button>
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'clients' ? 'text-thrst-green' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('clients')}
            data-testid="nav-clients"
          >
            <Users className="h-5 w-5" />
            <span className="text-xs">Clients</span>
          </button>
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'workouts' ? 'text-thrst-green' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('workouts')}
            data-testid="nav-workouts"
          >
            <Dumbbell className="h-5 w-5" />
            <span className="text-xs">Workouts</span>
          </button>
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'analytics' ? 'text-thrst-green' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('analytics')}
            data-testid="nav-analytics"
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-xs">Analytics</span>
          </button>
        </div>
      </nav>
    </div>
  );
}