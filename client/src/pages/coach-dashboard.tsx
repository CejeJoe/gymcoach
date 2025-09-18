import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BroadcastComposer } from "@/components/broadcast/BroadcastComposer";
import { MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useTheme } from "@/components/ui/theme-provider";
import { getAuthHeaders, authStorage } from "@/lib/auth";
import { CoachStats, ClientData, AuthUser } from "@/lib/types";
import ClientManagement from "./client-management";
import ChatThread from "@/components/chat-thread";
import { useMessageThread } from "@/hooks/use-messages";
import { DashboardCustomization } from '../components/ui/dashboard-customization';
import type { DashboardPreferences } from '../components/ui/dashboard-customization';
import { ClientFeedbackPanel } from '../components/ui/client-feedback-panel';
import { ReportsDashboard } from '../components/ui/simple-reports-dashboard';
import WorkoutManagement from "./workout-management";
import { toast } from "sonner";
import { Skeleton, DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { useMediaQuery } from "@/hooks/use-media-query";
import SessionLogDialog from "@/components/session-log-dialog";
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
  Megaphone,
  ArrowRight,
  Download,
  Settings,
  AlertCircle,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

// Simple inline profile edit form for Settings tab
function EditProfileForm({ initial }: { initial: { firstName: string; lastName: string; email: string } }) {
  const [firstName, setFirstName] = useState(initial.firstName || "");
  const [lastName, setLastName] = useState(initial.lastName || "");
  const [email, setEmail] = useState(initial.email || "");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ firstName, lastName, email })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to update profile');
      }
      const updated = await res.json();
      // Persist updated user to auth storage and refresh
      const user = authStorage.getUser();
      authStorage.setUser({ ...(user || {}), ...updated });
      toast.success('Profile updated');
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">First Name</label>
          <input
            className="mt-1 w-full bg-background border border-white/10 rounded px-3 py-2 text-sm"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Last Name</label>
          <input
            className="mt-1 w-full bg-background border border-white/10 rounded px-3 py-2 text-sm"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          type="email"
          className="mt-1 w-full bg-background border border-white/10 rounded px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="rounded-xl">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

type ApiError = {
  message: string;
  status?: number;
};

interface CoachDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function CoachDashboard({ user, onLogout }: CoachDashboardProps) {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  // Persist active tab across refresh for better UX
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return localStorage.getItem('coach-active-tab') || 'overview';
    } catch {
      return 'overview';
    }
  });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [logClientId, setLogClientId] = useState<string | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [showEditProfile, setShowEditProfile] = useState(false);
  // PWA install support
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  
  // Dashboard customization state
  const [dashboardPreferences, setDashboardPreferences] = useState<DashboardPreferences>({
    layout: 'grid',
    widgets: [
      { id: 'client-overview', title: 'Client Overview', component: 'ClientOverview', enabled: true, order: 1, size: 'large' },
      { id: 'recent-workouts', title: 'Recent Workouts', component: 'RecentWorkouts', enabled: true, order: 2, size: 'medium' },
      { id: 'client-feedback', title: 'Client Feedback', component: 'ClientFeedback', enabled: true, order: 3, size: 'medium' },
      { id: 'progress-charts', title: 'Progress Charts', component: 'ProgressCharts', enabled: true, order: 4, size: 'large' },
      { id: 'client-messages', title: 'Recent Messages', component: 'ClientMessages', enabled: true, order: 5, size: 'medium' },
    ],
    showClientFeedback: false,
    feedbackPosition: 'top',
    autoRefresh: true,
    refreshInterval: 30,
    theme: 'default'
  });

  // Capture PWA beforeinstallprompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler as any);
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  // Load preferences from localStorage
  useEffect(() => {
    const savedPreferences = localStorage.getItem('coach-dashboard-preferences');
    if (savedPreferences) {
      try {
        setDashboardPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.error('Error loading dashboard preferences:', error);
      }
    }
  }, []);

  // Save active tab to localStorage so refresh keeps you on the same page
  useEffect(() => {
    try {
      localStorage.setItem('coach-active-tab', activeTab);
    } catch {}
  }, [activeTab]);

  // Save preferences to localStorage
  const handlePreferencesChange = (newPreferences: DashboardPreferences) => {
    setDashboardPreferences(newPreferences);
    localStorage.setItem('coach-dashboard-preferences', JSON.stringify(newPreferences));
  };

  // unread indicator for Messages tab
  const { data: threadMsgs } = useMessageThread(
    user.id ?? null,
    selectedClientId,
    { enabled: Boolean(user.id && selectedClientId), limit: 50, refetchIntervalMs: 4000 }
  );
  const unreadCount = useMemo(() => {
    const arr = threadMsgs ?? [];
    return arr.filter(m => m.senderId !== user.id && !m.readAt).length;
  }, [threadMsgs, user.id]);

  const fetchWithErrorHandling = async <T,>(
    url: string,
    errorMessage: string
  ): Promise<T> => {
    try {
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error: ApiError = {
          message: `${errorMessage}: ${response.statusText}`,
          status: response.status,
        };
        throw error;
      }
      
      return response.json();
    } catch (error) {
      const apiError = error as ApiError;
      toast.error(apiError.message || 'An error occurred');
      throw error;
    }
  };

  const { 
    data: stats, 
    isLoading: statsLoading, 
    error: statsError 
  } = useQuery<CoachStats, ApiError>({
    queryKey: ['/api/coach/stats'],
    queryFn: () => fetchWithErrorHandling<CoachStats>(
      '/api/coach/stats', 
      'Failed to fetch stats'
    ),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const { 
    data: clientsData, 
    isLoading: clientsLoading,
    error: clientsError
  } = useQuery<ClientData[], ApiError>({
    queryKey: ['/api/coach/clients'],
    queryFn: async () => {
      const raw = await fetchWithErrorHandling<any>(
        '/api/coach/clients', 
        'Failed to fetch clients'
      );
      // Normalize possible shapes: either an array or { clients: [] }
      const arr: ClientData[] = Array.isArray(raw) ? raw : (raw?.clients ?? []);
      return arr;
    },
    // Be aggressive to avoid stale "No clients" after navigating back
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 2,
  });
  
  // Memoize filtered clients; treat missing isActive as active
  const clients = useMemo(() => {
    const arr = Array.isArray(clientsData) ? clientsData : [];
    return arr.filter(client => client.isActive !== false);
  }, [clientsData]);

  // Helper to compute today's local start/end
  const todayRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }, []);

  // Fetch today's workouts (exclude completed)
  const { data: todaysWorkouts } = useQuery<any[]>({
    queryKey: ['/api/coach/workouts', 'today', todayRange.start.getTime(), todayRange.end.getTime()],
    queryFn: async () => {
      const params = new URLSearchParams({
        includeCompleted: 'false',
        startDate: String(todayRange.start.getTime()),
        endDate: String(todayRange.end.getTime()),
      });
      const res = await fetch(`/api/coach/workouts?${params.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch today\'s workouts');
      return res.json();
    },
    enabled: Boolean(user?.id),
    refetchInterval: 60_000,
  });

  // Ensure a default selection for Messages tab
  useEffect(() => {
    if (!selectedClientId && clients && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  // Handle errors with toast notifications
  useEffect(() => {
    if (statsError) {
      toast.error(statsError.message || 'Failed to load dashboard statistics');
    }
    if (clientsError) {
      toast.error(clientsError.message || 'Failed to load clients');
    }
  }, [statsError, clientsError]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/coach/stats'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/coach/clients'] })
      ]);
      toast.success('Dashboard data refreshed');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // Helpers for UI: initials avatar and time label
  const getInitials = (first?: string | null, last?: string | null) => {
    const f = (first || '').trim();
    const l = (last || '').trim();
    const fi = f ? f[0] : '';
    const li = l ? l[0] : '';
    return (fi + li || 'C').toUpperCase();
  };

  const formatTimeLabel = (ts?: Date | string | number | null) => {
    if (!ts) return 'Anytime';
    try {
      const d = ts instanceof Date ? ts : new Date(ts as any);
      if (isNaN(d.getTime())) return 'Anytime';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Anytime';
    }
  };

  // Complete workout with duration 0 and no notes; then refresh today's list
  const completeWorkoutQuick = useCallback(async (workoutId: string) => {
    try {
      const res = await fetch(`/api/coach/workouts/${workoutId}/complete`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: 0 }),
      });
      if (!res.ok) throw new Error('Failed to complete workout');
      toast.success('Workout marked as done');
      await queryClient.invalidateQueries({ queryKey: ['/api/coach/workouts', 'today', todayRange.start.getTime(), todayRange.end.getTime()] });
    } catch (e) {
      toast.error('Could not mark workout as done');
    }
  }, [queryClient, todayRange.start, todayRange.end]);

  // Do not early-return; keep header visible and render skeletons below when loading

  // Check for empty states
  const hasClients = clients && clients.length > 0;
  const hasStats = stats && Object.keys(stats).length > 0;
  const upcomingCount = stats?.upcomingWorkouts?.length ?? 0;
  const hasUpcomingSessions = upcomingCount > 0;
  const avgProgressPct = Math.max(0, Math.min(100, Math.round(stats?.avgProgress || 0)));
  const activeRatioPct = stats?.totalClients ? Math.round(((stats?.activeClients || 0) / Math.max(1, stats.totalClients)) * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass-morphism sticky top-0 z-40 p-3 sm:p-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center min-w-0 gap-3">
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg truncate">Coach Dashboard</h1>
              <p className="text-xs text-muted-foreground truncate">
                Welcome back, <span className="font-medium" data-testid="user-firstname">{user.firstName}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Mobile-only Reports chip */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl md:hidden"
              title="Reports"
              aria-label="Reports"
              onClick={() => setActiveTab('reports')}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshData}
              disabled={isRefreshing}
              className="glass-morphism rounded-xl flex items-center gap-2 transition-all duration-200 hover:bg-opacity-80"
              aria-label={isRefreshing ? 'Refreshing...' : 'Refresh data'}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            {canInstall && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await deferredPrompt.prompt();
                    await deferredPrompt.userChoice;
                  } finally {
                    setCanInstall(false);
                    setDeferredPrompt(null);
                  }
                }}
                className="glass-morphism rounded-xl"
              >
                Install
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="glass-morphism rounded-xl"
              data-testid="button-theme-toggle"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="bg-thrst-accent/20 rounded-xl hover:bg-thrst-accent/30 flex items-center gap-2"
              data-testid="button-logout"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4 text-thrst-accent" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs container. Desktop shows top tabs; mobile uses bottom nav. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" defaultValue="overview">

        {/* Desktop top tab navigation */}
        <div className="hidden md:block glass-morphism border-b border-white/10 px-2 md:px-4">
          <TabsList className="bg-transparent h-auto md:h-12 w-full justify-start overflow-x-auto py-1">
            <TabsTrigger 
              value="overview" 
              className="whitespace-nowrap px-3 py-2 text-sm md:text-base data-[state=active]:bg-yellow-400/20 data-[state=active]:text-yellow-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-400 focus-visible:outline-none"
              data-testid="tab-overview"
              role="tab"
              aria-selected={activeTab === 'overview'}
              tabIndex={activeTab === 'overview' ? 0 : -1}
              id="overview-tab"
            >
              <TrendingUp className="h-4 w-4 mr-2" aria-hidden="true" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="clients" 
              className="data-[state=active]:bg-yellow-400/20 data-[state=active]:text-yellow-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-400 focus-visible:outline-none"
              data-testid="tab-clients"
              role="tab"
              aria-selected={activeTab === 'clients'}
              tabIndex={activeTab === 'clients' ? 0 : -1}
              aria-controls="clients-tabpanel"
              id="clients-tab"
            >
              <Users className="h-4 w-4 mr-2" aria-hidden="true" />
              <span>Clients</span>
            </TabsTrigger>
            <TabsTrigger 
              value="workouts" 
              className="data-[state=active]:bg-yellow-400/20 data-[state=active]:text-yellow-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-400 focus-visible:outline-none"
              data-testid="tab-workouts"
              role="tab"
              aria-selected={activeTab === 'workouts'}
              tabIndex={activeTab === 'workouts' ? 0 : -1}
              aria-controls="workouts-tabpanel"
              id="workouts-tab"
            >
              <Dumbbell className="h-4 w-4 mr-2" aria-hidden="true" />
              <span>Workouts</span>
            </TabsTrigger>
            <TabsTrigger 
              value="messages" 
              className="relative data-[state=active]:bg-yellow-400/20 data-[state=active]:text-yellow-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-400 focus-visible:outline-none"
              data-testid="tab-messages"
              role="tab"
              aria-selected={activeTab === 'messages'}
              tabIndex={activeTab === 'messages' ? 0 : -1}
              aria-controls="messages-tabpanel"
              id="messages-tab"
            >
              <div className="relative mr-2">
                <Users className="h-4 w-4" aria-hidden="true" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-yellow-400 border border-black/50" />}
              </div>
              <span>Messages</span>
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="data-[state=active]:bg-yellow-400/20 data-[state=active]:text-yellow-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-400 focus-visible:outline-none"
              data-testid="tab-reports"
              role="tab"
              aria-selected={activeTab === 'reports'}
              tabIndex={activeTab === 'reports' ? 0 : -1}
              aria-controls="reports-tabpanel"
              id="reports-tab"
            >
              <Target className="h-4 w-4 mr-2" aria-hidden="true" />
              <span>Reports</span>
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-yellow-400/20 data-[state=active]:text-yellow-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-400 focus-visible:outline-none"
              data-testid="tab-settings"
              role="tab"
              aria-selected={activeTab === 'settings'}
              tabIndex={activeTab === 'settings' ? 0 : -1}
              aria-controls="settings-tabpanel"
              id="settings-tab"
            >
              <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Mobile bottom tab navigation */}
        <nav className="md:hidden glass-morphism fixed bottom-0 left-0 right-0 p-2 border-t border-white/10 z-50">
          <div className="flex justify-around max-w-md mx-auto">
            <button 
              className={`flex flex-col items-center space-y-1 ${activeTab === 'overview' ? 'text-yellow-400' : 'text-muted-foreground'} ${activeTab === 'overview' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-yellow-400 after:shadow-[0_0_8px_rgba(255,165,0,0.6)]' : ''}`}
              onClick={() => setActiveTab('overview')}
              data-testid="nav-overview"
            >
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs">Overview</span>
            </button>
            <button 
              className={`flex flex-col items-center space-y-1 ${activeTab === 'clients' ? 'text-yellow-400' : 'text-muted-foreground'} ${activeTab === 'clients' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-yellow-400 after:shadow-[0_0_8px_rgba(255,165,0,0.6)]' : ''}`}
              onClick={() => setActiveTab('clients')}
              data-testid="nav-clients"
            >
              <Users className="h-5 w-5" />
              <span className="text-xs">Clients</span>
            </button>
            <button 
              className={`flex flex-col items-center space-y-1 ${activeTab === 'workouts' ? 'text-yellow-400' : 'text-muted-foreground'} ${activeTab === 'workouts' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-yellow-400 after:shadow-[0_0_8px_rgba(255,165,0,0.6)]' : ''}`}
              onClick={() => setActiveTab('workouts')}
              data-testid="nav-workouts"
            >
              <Dumbbell className="h-5 w-5" />
              <span className="text-xs">Workouts</span>
            </button>
            <button 
              className={`relative flex flex-col items-center space-y-1 ${activeTab === 'messages' ? 'text-yellow-400' : 'text-muted-foreground'} ${activeTab === 'messages' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-yellow-400 after:shadow-[0_0_8px_rgba(255,165,0,0.6)]' : ''}`}
              onClick={() => setActiveTab('messages')}
              data-testid="nav-messages"
            >
              <div className="relative">
                <Users className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-yellow-400 border border-black/50" />
                )}
              </div>
              <span className="text-xs">Messages</span>
            </button>
            <button 
              className={`flex flex-col items-center space-y-1 ${activeTab === 'settings' ? 'text-yellow-400' : 'text-muted-foreground'} ${activeTab === 'settings' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-yellow-400 after:shadow-[0_0_8px_rgba(255,165,0,0.6)]' : ''}`}
              onClick={() => setActiveTab('settings')}
              data-testid="nav-settings"
            >
              <Settings className="h-5 w-5" />
              <span className="text-xs">Settings</span>
            </button>
          </div>
        </nav>

        <TabsContent 
          value="overview" 
          className="p-4 space-y-6" 
          role="tabpanel" 
          id="overview-tabpanel"
          aria-labelledby="overview-tab"
        >
          {/* Compact toolbar: minimal icon actions (no Add Client) */}
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              title="Create Workout"
              onClick={() => setActiveTab('workouts')}
            >
              <Dumbbell className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              title="Broadcast"
              onClick={() => setIsBroadcastOpen(true)}
            >
              <Megaphone className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            {/* Inline Install App callout */}
            {canInstall && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>Install app for faster access</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 py-0 rounded-xl"
                  onClick={async () => {
                    try {
                      await deferredPrompt?.prompt();
                      await deferredPrompt?.userChoice;
                    } finally {
                      setCanInstall(false);
                      setDeferredPrompt(null);
                    }
                  }}
                >
                  Install
                </Button>
              </div>
            )}
          </div>

          {/* Small Reports teaser (tap to open Reports tab) */}
          <GlassCard className="p-3 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-yellow-400" />
                <div className="text-sm font-medium">Reports</div>
              </div>
              <Button size="icon" variant="ghost" className="rounded-xl h-7 w-7" onClick={() => setActiveTab('reports')} aria-label="Go to reports">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                {statsLoading ? <Skeleton className="h-4 w-10 mx-auto" /> : <div className="text-sm font-semibold">{stats?.totalClients ?? 0}</div>}
                <div className="text-[10px] text-muted-foreground">Clients</div>
              </div>
              <div>
                {statsLoading ? <Skeleton className="h-4 w-10 mx-auto" /> : <div className="text-sm font-semibold">{stats?.completedWorkouts ?? 0}</div>}
                <div className="text-[10px] text-muted-foreground">Workouts</div>
              </div>
              <div>
                {statsLoading ? <Skeleton className="h-4 w-10 mx-auto" /> : <div className="text-sm font-semibold">{stats?.avgProgress ?? 0}%</div>}
                <div className="text-[10px] text-muted-foreground">Progress</div>
              </div>
            </div>
          </GlassCard>

          {/* Install App chip at bottom of Overview */}
          {canInstall && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="rounded-full h-8 px-3 text-xs"
                onClick={async () => {
                  try {
                    await deferredPrompt?.prompt();
                    await deferredPrompt?.userChoice;
                  } finally {
                    setCanInstall(false);
                    setDeferredPrompt(null);
                  }
                }}
              >
                <Download className="h-4 w-4 mr-1" /> Install App
              </Button>
            </div>
          )}

          {/* Neon KPI Rings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassCard className="p-4">
              <div className="flex items-center gap-4">
                {statsLoading ? (
                  <div className="w-full"><Skeleton className="h-24 w-full rounded-xl" /></div>
                ) : (
                <ProgressRing
                  progress={avgProgressPct}
                  size={120}
                  strokeWidth={8}
                  className="filter drop-shadow-[0_0_12px_rgba(255,60,0,0.6)]"
                >
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-thrst-accent" data-testid="kpi-health-score">
                      {avgProgressPct}%
                    </div>
                    <div className="text-[11px] text-muted-foreground -mt-1">Health Score</div>
                  </div>
                </ProgressRing>
                )}
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-1">Client Health</h4>
                  <p className="text-xs text-muted-foreground mb-2">Average progress across all clients</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-thrst-accent border-thrst-accent/40">Accent</Badge>
                    <span className="text-xs text-muted-foreground">Glowing KPI</span>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center gap-4">
                {statsLoading ? (
                  <div className="w-full"><Skeleton className="h-24 w-full rounded-xl" /></div>
                ) : (
                <ProgressRing
                  progress={activeRatioPct}
                  size={120}
                  strokeWidth={8}
                  className="filter drop-shadow-[0_0_12px_rgba(255,60,0,0.6)]"
                >
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-thrst-accent" data-testid="kpi-active-ratio">
                      {activeRatioPct}%
                    </div>
                    <div className="text-[11px] text-muted-foreground -mt-1">Active Clients</div>
                  </div>
                </ProgressRing>
                )}
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-1">Engagement</h4>
                  <p className="text-xs text-muted-foreground mb-2">{stats?.activeClients || 0} of {stats?.totalClients || 0} clients active</p>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-thrst-accent"
                      style={{ width: `${activeRatioPct}%`, boxShadow: "0 0 12px rgba(255,60,0,0.6)" }}
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-4 gap-2">
            <GlassCard className="p-3">
              <div className="text-center">
                {statsLoading ? <Skeleton className="h-6 w-10 mx-auto" /> : (
                  <div className="text-lg font-bold text-yellow-400" data-testid="text-total-clients">
                    {stats?.totalClients || 0}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">Clients</div>
              </div>
            </GlassCard>
            
            <GlassCard className="p-3">
              <div className="text-center">
                {statsLoading ? <Skeleton className="h-6 w-10 mx-auto" /> : (
                  <div className="text-lg font-bold text-yellow-400" data-testid="text-avg-progress">
                    {stats?.avgProgress || 0}%
                  </div>
                )}
                <div className="text-xs text-muted-foreground">Progress</div>
              </div>
            </GlassCard>

            <GlassCard className="p-3">
              <div className="text-center">
                {statsLoading ? <Skeleton className="h-6 w-10 mx-auto" /> : (
                  <div className="text-lg font-bold text-blue-400" data-testid="text-completed-workouts">
                    {stats?.completedWorkouts || 0}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">Workouts</div>
              </div>
            </GlassCard>

            <GlassCard className="p-3">
              <div className="text-center">
                {statsLoading ? <Skeleton className="h-6 w-10 mx-auto" /> : (
                  <div className="text-lg font-bold text-purple-400" data-testid="text-active-clients">
                    {stats?.activeClients || 0}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </GlassCard>
          </div>

          {/* Clients to Train Today (Compact) */}
          <GlassCard>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-400" />
                Today's Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.isArray(todaysWorkouts) && todaysWorkouts.length > 0 ? (
                todaysWorkouts.map((w: any) => {
                  const c = clients.find(cl => cl.id === w.clientId);
                  const first = c?.user?.firstName || 'Client';
                  const last = c?.user?.lastName || '';
                  const clientLabel = `${first} ${last}`.trim();
                  const initials = getInitials(first, last);
                  return (
                    <div key={w.id} className="flex items-center justify-between p-2.5 glass-morphism rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate max-w-[180px]">{clientLabel}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                              {formatTimeLabel(w.scheduledDate)}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {w.name || 'Workout'} • {(w.exercises?.length || 0)} ex
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl h-8 px-2 text-xs"
                          onClick={() => completeWorkoutQuick(w.id)}
                        >
                          Done
                        </Button>
                        <Button
                          size="sm"
                          className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 rounded-xl h-8 px-2 text-xs"
                          onClick={() => { setLogClientId(w.clientId); setIsLogOpen(true); }}
                        >
                          Log
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-4">No sessions scheduled for today</p>
              )}
            </CardContent>
          </GlassCard>
        </TabsContent>

        <TabsContent 
          value="messages"
          className="p-2 md:p-4"
          role="tabpanel"
          id="messages-tabpanel"
          aria-labelledby="messages-tab"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Client</label>
                <select
                  className="bg-background border border-white/10 rounded-md px-2 py-1 text-sm"
                  value={selectedClientId ?? ''}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  {(clients || []).map(c => (
                    <option key={c.id} value={c.id}>{c.user?.firstName || 'Client'} {c.user?.lastName || ''}</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={() => setIsBroadcastOpen(true)}
                className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 border border-yellow-400/30 rounded-full px-4 py-2 text-sm flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Broadcast
              </Button>
            </div>

            {selectedClientId ? (
              <ChatThread
                coachId={user.id}
                clientId={selectedClientId}
                currentUserId={user.id}
                title="Chat with Client"
              />
            ) : (
              <div className="text-center text-muted-foreground py-8">No clients available</div>
            )}
          </div>
        </TabsContent>

        <TabsContent 
          value="clients" 
          role="tabpanel" 
          id="clients-tabpanel"
          aria-labelledby="clients-tab"
          className="p-2 md:p-4"
        >
          {hasClients ? (
            <ClientManagement user={user} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="p-4 rounded-full bg-muted/20 mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-foreground">No clients yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                You haven't added any clients yet. Get started by adding your first client to track their progress and schedule workouts.
              </p>
              <Button 
                className="bg-thrst-accent/20 hover:bg-thrst-accent/30 text-thrst-accent"
                onClick={() => setActiveTab('clients')}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Your First Client
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent 
          value="workouts" 
          role="tabpanel"
          id="workouts-tabpanel"
          aria-labelledby="workouts-tab"
          className="p-2 md:p-4"
        >
          {hasStats ? (
            <WorkoutManagement user={user} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="p-4 rounded-full bg-muted/20 mb-4">
                <Dumbbell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-foreground">No workouts yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Create your first workout plan to get started. You can assign workouts to your clients once you've added them.
              </p>
              <Button 
                className="bg-thrst-accent/20 hover:bg-thrst-accent/30 text-thrst-accent"
                onClick={() => setActiveTab('workouts')}
              >
                <Dumbbell className="h-4 w-4 mr-2" />
                Create Workout
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent 
          value="analytics" 
          className="p-4 space-y-6" 
          role="tabpanel" 
          id="analytics-tabpanel"
          aria-labelledby="analytics-tab"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-xl font-bold mb-2 sm:mb-0">Analytics Dashboard</h2>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs"
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" className="text-xs">
                Export
              </Button>
            </div>
          </div>

          {hasStats ? (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
            <GlassCard className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Clients
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <div className="text-xl md:text-2xl font-bold">
                  {stats?.activeClients || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active clients
                </p>
              </CardContent>
            </GlassCard>

            <GlassCard className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-2">
                <CardTitle className="text-sm font-medium">
                  Upcoming Sessions
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <div className="text-xl md:text-2xl font-bold">
                  {upcomingCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  Scheduled
                </p>
              </CardContent>
            </GlassCard>

            <GlassCard className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-2">
                <CardTitle className="text-sm font-medium">
                  Success Rate
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <div className="text-xl md:text-2xl font-bold">
                  {stats?.avgProgress || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg. progress
                </p>
              </CardContent>
            </GlassCard>

            <GlassCard className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-2">
                <CardTitle className="text-sm font-medium">
                  Workouts
                </CardTitle>
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <div className="text-xl md:text-2xl font-bold">
                  {stats?.completedWorkouts || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </GlassCard>
          </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4 rounded-xl border-2 border-dashed border-muted">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2 text-foreground">No analytics data yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Your analytics dashboard will populate once you start adding clients and tracking their progress.
              </p>
              <Button 
                variant="outline"
                onClick={() => setActiveTab('clients')}
              >
                <Users className="h-4 w-4 mr-2" />
                Add Clients
              </Button>
            </div>
          )}

          {hasStats && (
            <div className="grid gap-4">
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4">Monthly Progress</h3>
                <div className="h-48 flex items-center justify-center">
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

              <GlassCard className="p-4">
                <h3 className="font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Dumbbell className="h-4 w-4 text-yellow-400" />
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
            </div>
          )}
        </TabsContent>

        <TabsContent 
          value="reports" 
          className="p-4 space-y-6" 
          role="tabpanel" 
          id="reports-tabpanel"
          aria-labelledby="reports-tab"
        >
          <ReportsDashboard coachId={user.id} />
        </TabsContent>

        <TabsContent 
          value="settings" 
          className="p-4 space-y-6" 
          role="tabpanel" 
          id="settings-tabpanel"
          aria-labelledby="settings-tab"
        >
          <div>
            <h2 className="text-xl font-bold mb-4">Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="pt-2">
                  {!showEditProfile ? (
                    <Button size="sm" onClick={() => setShowEditProfile(true)} className="rounded-xl">Edit</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setShowEditProfile(false)} className="rounded-xl">Cancel</Button>
                  )}
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <h3 className="font-semibold mb-4">Edit Profile</h3>
              {showEditProfile ? (
                <EditProfileForm initial={{ firstName: user.firstName, lastName: user.lastName, email: user.email }} />
              ) : (
                <p className="text-sm text-muted-foreground">Click Edit to update your profile details.</p>
              )}
            </GlassCard>

            {/* Dashboard customization is moved here (works on mobile and desktop) */}
            <GlassCard className="p-4 md:col-span-2">
              <h3 className="font-semibold mb-4">Dashboard Customization</h3>
              <DashboardCustomization 
                preferences={dashboardPreferences}
                onPreferencesChange={handlePreferencesChange}
              />
            </GlassCard>
          </div>
        </TabsContent>
      </Tabs>

      {/* Sidebar Client Feedback Panel */}
      {dashboardPreferences.showClientFeedback && dashboardPreferences.feedbackPosition === 'sidebar' && (
        <div className="fixed right-4 top-20 bottom-20 w-80 z-30 hidden lg:block">
          <ClientFeedbackPanel 
            position="sidebar" 
            isProminent={true}
            maxHeight="calc(100vh - 200px)"
          />
        </div>
      )}

      {logClientId && (
        <SessionLogDialog
          open={isLogOpen}
          onOpenChange={(v) => setIsLogOpen(v)}
          clientId={logClientId}
          coachId={user.id}
          defaultExercises={[]}
        />
      )}
      
      {/* Bottom Client Feedback Panel */}
      {dashboardPreferences.showClientFeedback && dashboardPreferences.feedbackPosition === 'bottom' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-background/95 backdrop-blur-sm border-t">
          <ClientFeedbackPanel 
            position="bottom" 
            isProminent={true}
            maxHeight="200px"
          />
        </div>
      )}
      {activeTab === 'settings' && !hasStats && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <Settings className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2 text-foreground">Account Settings</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Customize your account settings and preferences here.
          </p>
        </div>
      )}

      {/* Broadcast Composer */}
      <BroadcastComposer 
        open={isBroadcastOpen} 
        onOpenChange={setIsBroadcastOpen} 
      />
    </div>
  );
}