import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { useTheme } from "@/components/ui/theme-provider";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ClientStats, WorkoutData, AuthUser, ClientData, ProgressData } from "@/lib/types";
import ChatThread from "@/components/chat-thread";
import { ChartCard } from "@/components/ChartCard";
import { useMessageThread } from "@/hooks/use-messages";
import { 
  Home, 
  Dumbbell, 
  TrendingUp, 
  User, 
  MessageSquare,
  Moon, 
  Sun, 
  LogOut,
  CheckCircle,
  Circle,
  Calendar,
  Target,
  Search,
  ChevronDown,
  Timer,
  Flame,
  Play,
  Quote
} from "lucide-react";

interface ClientPortalProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function ClientPortal({ user, onLogout }: ClientPortalProps) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("home");
  // Feature flag: hide client self-start workout entry points (voice/manual)
  // Keeps functionality intact for future admin toggle; only hides UI now.
  const SHOW_SELF_LOGGING = false;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [frontView, setFrontView] = useState(true);
  const [showMuscleFilter, setShowMuscleFilter] = useState(false);
  const [showDurationFilter, setShowDurationFilter] = useState(false);
  const [showDaysFilter, setShowDaysFilter] = useState(false);
  const [durationFilter, setDurationFilter] = useState<string>("30-45 Min");
  const [daysFilter, setDaysFilter] = useState<string>("3 Workout Days");

  const motivationalQuotes = [
    "The only bad workout is the one that didn't happen.",
    "Your body can stand almost anything. It’s your mind that you have to convince.",
    "Success isn’t always about greatness. It’s about consistency. Consistent hard work gains success. Greatness will come.",
    "The last three or four reps is what makes the muscle grow. This area of pain divides the champion from someone else who is not a champion.",
    "Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle."
  ];

  const [quote, setQuote] = useState('');

  useEffect(() => {
    setQuote(motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);
  }, []);

  // State for completion dialog
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeWorkoutId, setCompleteWorkoutId] = useState<string | null>(null);
  const [duration, setDuration] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // State for change password dialog
  const [changeOpen, setChangeOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Data Fetching Hooks
  const { data: clientProfile } = useQuery<ClientData>({
    queryKey: ['/api/client/profile', user.id],
    queryFn: async () => {
      const response = await fetch('/api/client/profile', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
    refetchOnMount: 'always',
  });

  const { data: progressEntries } = useQuery<ProgressData[]>({
    queryKey: ["/api/client/progress", user.id],
    queryFn: async () => {
      const response = await fetch("/api/client/progress", { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Failed to fetch progress");
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ClientStats>({
    queryKey: ['/api/client/stats', user.id],
    queryFn: async () => {
      const response = await fetch('/api/client/stats', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchOnMount: 'always',
  });

  const { data: workouts, isLoading: workoutsLoading } = useQuery<WorkoutData[]>({
    queryKey: ['/api/workouts/client', user.id],
    queryFn: async () => {
      const response = await fetch('/api/workouts/client', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch workouts');
      const data = await response.json();
      // Normalize and log for diagnostics
      const normalized = Array.isArray(data) ? data : (Array.isArray(data?.workouts) ? data.workouts : []);
      try {
        console.debug('[MyWorkouts] /api/workouts/client status', response.status, 'items:', normalized.length);
      } catch {}
      return normalized;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Workout history for quick stats and recent activity
  const { data: workoutHistory } = useQuery<{ entries: any[]; sessions: any[]}>({
    queryKey: ['/api/workouts/history', user.id],
    queryFn: async () => {
      const response = await fetch('/api/workouts/history', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch workout history');
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: threadMsgs } = useMessageThread(
    clientProfile?.coachId ?? null,
    clientProfile?.id ?? null,
    { enabled: !!(clientProfile?.coachId && clientProfile?.id), limit: 50, refetchIntervalMs: 4000 }
  );

  // Memoized Calculations
  const bodyFatChartData = useMemo(() => {
    return (progressEntries || [])
      .filter((e) => typeof e.bodyFat === "number" && e.bodyFat !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((e) => ({ date: new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: e.bodyFat as number }));
  }, [progressEntries]);

  const muscleMassChartData = useMemo(() => {
    return (progressEntries || [])
      .filter((e) => typeof e.muscleMass === "number" && e.muscleMass !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((e) => ({ date: new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: e.muscleMass as number }));
  }, [progressEntries]);

  const weightChartData = useMemo(() => {
    return (progressEntries || [])
      .filter((e) => typeof e.weight === "number" && e.weight !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((e) => ({ date: new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: e.weight as number }));
  }, [progressEntries]);

  const workoutStreak = useMemo(() => {
    if (!workouts) return 0;
    const completedDates = workouts
      .filter(w => w.completedAt)
      .map(w => new Date(w.completedAt!).setHours(0, 0, 0, 0));
    if (completedDates.length === 0) return 0;

    const uniqueTimestamps = Array.from(new Set(completedDates)).sort((a, b) => b - a);
    if (uniqueTimestamps.length === 0) return 0;

    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = new Date(today).setDate(new Date(today).getDate() - 1);

    if (uniqueTimestamps[0] !== today && uniqueTimestamps[0] !== yesterday) return 0;
    
    let streak = 1;
    for (let i = 0; i < uniqueTimestamps.length - 1; i++) {
      const oneDay = 24 * 60 * 60 * 1000;
      if (uniqueTimestamps[i] - uniqueTimestamps[i+1] === oneDay) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [workouts]);

  const unreadCount = useMemo(() => {
    return (threadMsgs ?? []).filter(m => m.senderId !== user.id && !m.readAt).length;
  }, [threadMsgs, user.id]);

  // Mutations
  const completeMutation = useMutation({
    mutationFn: async (vars: { workoutId: string; duration: number; notes?: string }) => {
      const res = await fetch(`/api/workouts/${vars.workoutId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ duration: vars.duration, notes: vars.notes }),
      });
      if (!res.ok) throw new Error('Failed to complete workout');
      return res.json();
    },
    onSuccess: async () => {
      setCompleteOpen(false);
      setCompleteWorkoutId(null);
      setDuration("");
      setNotes("");
      await qc.invalidateQueries({ queryKey: ['/api/workouts/client'] });
      await qc.invalidateQueries({ queryKey: ['/api/client/stats'] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (vars: { currentPassword: string; newPassword: string }) => {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(vars),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err?.message || 'Failed to change password');
      }
      return res.json();
    },
    onSuccess: () => {
      setChangeOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
    },
    onError: (e: any) => {
      toast({ title: 'Failed to change password', description: e?.message || 'Please try again', variant: 'destructive' });
    }
  });

  const openComplete = (workoutId: string) => {
    setCompleteWorkoutId(workoutId);
    setCompleteOpen(true);
  };

  const submitComplete = () => {
    if (!completeWorkoutId) return;
    const d = Number(duration);
    completeMutation.mutate({ workoutId: completeWorkoutId, duration: isNaN(d) ? 0 : d, notes: notes || undefined });
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (statsLoading || workoutsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
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
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">My Fitness</h1>
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

            {/* Motivational Quote */}
      <div className="p-4 text-center">
        <GlassCard className="p-4">
          <div className="flex items-center justify-center space-x-2">
            <Quote className="h-5 w-5 text-yellow-400" />
            <p className="text-sm italic text-muted-foreground">{quote}</p>
          </div>
        </GlassCard>
      </div>

      {/* Tab Content */}
      {activeTab === "home" && (
        <div className="p-4 space-y-4">
          {/* Hero CTAs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHOW_SELF_LOGGING && (
              <Button 
                onClick={() => setLocation('/workout-logging?mode=voice')}
                className="w-full bg-thrst-accent hover:bg-thrst-accent/90 text-black font-semibold"
                aria-label="Start voice workout"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Voice Workout
              </Button>
            )}
            {SHOW_SELF_LOGGING && (
              <Button 
                onClick={() => setLocation('/workout-logging?mode=manual')}
                variant="outline"
                className="w-full"
                aria-label="Start manual workout"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Manual Workout
              </Button>
            )}
            <Button 
              onClick={() => setActiveTab('progress')}
              variant="outline"
              className="w-full"
              aria-label="View progress"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              View Progress
            </Button>
            {(() => {
              const uncompleted = (workouts || []).filter(w => !w.completedAt);
              const today = new Date().toDateString();
              const hasTodayAssigned = uncompleted.some(w => w.scheduledDate && new Date(w.scheduledDate).toDateString() === today);
              if (!hasTodayAssigned && uncompleted.length === 0) return null;
              // Hide the start assigned entry if self-logging is disabled
              if (!SHOW_SELF_LOGGING) return null;
              return (
                <Button 
                  onClick={() => setLocation('/workout-logging?mode=manual')}
                  className="w-full"
                  aria-label="Start assigned workout"
                >
                  <Dumbbell className="h-4 w-4 mr-2" />
                  Start Assigned Workout
                </Button>
              );
            })()}
          </div>

          {/* Quick Stats */}
          <GlassCard className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Streak</div>
                <div className="text-2xl font-bold text-yellow-400">{workoutStreak}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Last Workout</div>
                <div className="text-sm font-medium">
                  {(() => {
                    const sessions = (workoutHistory?.sessions || []);
                    const entries = (workoutHistory?.entries || []);
                    const ts = sessions[0]?.endTime || sessions[0]?.startTime || entries[0]?.timestamp;
                    return ts ? new Date(ts).toLocaleString() : '—';
                  })()}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">This Week</div>
                <div className="text-2xl font-bold">
                  {(() => {
                    const entries = (workoutHistory?.entries || []);
                    const weekMs = 7 * 24 * 60 * 60 * 1000;
                    const now = Date.now();
                    return entries.filter((e:any) => (now - new Date(e.timestamp).getTime()) <= weekMs).length;
                  })()}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Assigned Workouts (next 1–2) */}
          {(() => {
            const upcoming = (workouts || []).filter(w => !w.completedAt).slice(0, 2);
            if (upcoming.length === 0) return null;
            return (
              <div className="space-y-3">
                {upcoming.map(w => (
                  <GlassCard key={w.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold">{w.name || 'Assigned Workout'}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{w.description || 'No description'}</p>
                        {w.scheduledDate && (
                          <p className="text-xs text-muted-foreground mt-1">Scheduled: {new Date(w.scheduledDate).toLocaleString()}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {SHOW_SELF_LOGGING && (
                          <Button size="sm" variant="outline" onClick={() => setLocation('/workout-logging?mode=manual')} aria-label={`Start ${w.name || 'assigned'} workout`}>Start</Button>
                        )}
                        <Button size="sm" className="bg-yellow-400 hover:bg-yellow-500 text-black" onClick={() => openComplete(w.id)} aria-label={`Mark ${w.name || 'assigned'} workout as complete`}>Complete</Button>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            );
          })()}

          {/* Recent Activity */}
          {(() => {
            const recent = (workoutHistory?.entries || []).slice(0, 5);
            if (recent.length === 0) return null;
            return (
              <GlassCard className="p-4">
                <h3 className="font-semibold mb-3">Recent Activity</h3>
                <div className="space-y-2">
                  {recent.map((e:any, idx:number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex-1">
                        <div className="font-medium capitalize">{e.exercise || 'Exercise'}</div>
                        <div className="text-muted-foreground text-xs">
                          {new Date(e.timestamp).toLocaleString()} · {e.reps ? `${e.reps} reps` : ''} {e.sets ? `x ${e.sets} sets` : ''} {e.weight ? `@ ${e.weight}kg` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            );
          })()}

          {/* Progress Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChartCard title="Weight" data={weightChartData} unit="kg" color="#fde047" />
            <ChartCard title="Body Fat" data={bodyFatChartData} unit="%" color="#84cc16" />
            <ChartCard title="Muscle Mass" data={muscleMassChartData} unit="kg" color="#3b82f6" />
          </div>

          {/* My Coach & Messages */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">My Coach</h3>
                <p className="text-sm text-muted-foreground">Stay in touch with your coach</p>
              </div>
              <Button size="sm" onClick={() => setActiveTab('messages')} className="relative">
                Messages
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-thrst-accent border border-black/50" />
                )}
              </Button>
            </div>
          </GlassCard>

          {/* Motivation */}
          <div className="text-center">
            <GlassCard className="p-4">
              <div className="flex items-center justify-center space-x-2">
                <Quote className="h-5 w-5 text-yellow-400" />
                <p className="text-sm italic text-muted-foreground">{quote}</p>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === "messages" && (
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Messages</h2>
          {clientProfile ? (
            <ChatThread
              coachId={clientProfile.coachId}
              clientId={clientProfile.id}
              currentUserId={user.id}
              title="Chat with your Coach"
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">Loading profile...</div>
          )}
        </div>
      )}

      {activeTab === "workouts" && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">My Workouts</h2>
            {SHOW_SELF_LOGGING && (
              <Button 
                onClick={() => setLocation('/workout-logging?mode=voice')}
                size="sm"
                className="bg-thrst-accent hover:bg-thrst-accent/90 text-black"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Workout
              </Button>
            )}
          </div>

          {workouts && workouts.length > 0 ? (
            <div className="space-y-3">
              {workouts.map((workout) => (
                <GlassCard key={workout.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{workout.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {workout.description || 'No description'}
                      </p>
                      {workout.scheduledDate && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Scheduled: {new Date(workout.scheduledDate).toLocaleDateString()}
                        </p>
                      )}
                      {workout.notes && workout.completedAt && (
                        <p className="text-xs italic text-muted-foreground mt-2 border-l-2 border-primary pl-2">
                          Your notes: {workout.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {workout.completedAt ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      ) : (
                        <Button size="sm" onClick={() => openComplete(workout.id)} className="bg-yellow-400 hover:bg-yellow-500 text-black">Complete</Button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <GlassCard className="p-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                  <Dumbbell className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">No workouts yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your coach will assign workouts for you
                  </p>
                </div>
                {SHOW_SELF_LOGGING && (
                  <Button 
                    onClick={() => setLocation('/workout-logging?mode=voice')}
                    className="bg-thrst-accent hover:bg-thrst-accent/90 text-black"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Free Workout
                  </Button>
                )}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === "progress" && (
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Progress Tracking</h2>
          <div className="space-y-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-4">
              <GlassCard className="p-4 text-center">
                <div className="text-2xl font-bold text-thrst-accent">
                  {stats?.completedWorkouts ?? 0}
                </div>
                <p className="text-sm text-muted-foreground">Workouts Done</p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <div className="text-2xl font-bold text-thrst-accent">
                  {stats?.totalWorkouts ?? 0}
                </div>
                <p className="text-sm text-muted-foreground">Total Assigned</p>
              </GlassCard>
            </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ChartCard title="Weight" data={weightChartData} unit="kg" color="#fde047" />
              <ChartCard title="Body Fat" data={bodyFatChartData} unit="%" color="#84cc16" />
              <ChartCard title="Muscle Mass" data={muscleMassChartData} unit="kg" color="#3b82f6" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <GlassCard className="p-4">
                <h3 className="font-semibold mb-2">Workout Streak</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-400">
                    {workoutStreak}
                  </div>
                  <p className="text-sm text-muted-foreground">Day Streak</p>
                </div>
              </GlassCard>
              <GlassCard className="p-4">
                <h3 className="font-semibold mb-2">Completion Rate</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {(stats?.totalWorkouts ?? 0) > 0
                      ? Math.round(((stats?.completedWorkouts ?? 0) / (stats.totalWorkouts || 1)) * 100)
                      : 0
                    }%
                  </div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Profile Settings</h2>
          <div className="space-y-4">
            <GlassCard className="p-4">
              <h3 className="font-semibold mb-2">Personal Information</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Name:</span> {user.firstName} {user.lastName}</p>
                <p><span className="font-medium">Email:</span> {user.email}</p>
                <p><span className="font-medium">Role:</span> Client</p>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <h3 className="font-semibold mb-2">Fitness Goals</h3>
              <p className="text-muted-foreground">Goal tracking coming soon</p>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Security</h3>
                  <p className="text-sm text-muted-foreground">Update your password</p>
                </div>
                <Button size="sm" onClick={() => setChangeOpen(true)}>Change Password</Button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="glass-morphism fixed bottom-0 left-0 right-0 p-2 border-t border-white/10 z-50">
        <div className="flex justify-around max-w-md mx-auto">
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'home' ? 'text-thrst-accent' : 'text-muted-foreground'} ${activeTab === 'home' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-thrst-accent after:shadow-[0_0_8px_var(--thrst-accent)]' : ''}`}
            onClick={() => setActiveTab('home')}
            data-testid="nav-home"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">My Workout</span>
          </button>
          <button 
            className={`relative flex flex-col items-center space-y-1 ${activeTab === 'messages' ? 'text-thrst-accent' : 'text-muted-foreground'} ${activeTab === 'messages' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-thrst-accent after:shadow-[0_0_8px_var(--thrst-accent)]' : ''}`}
            onClick={() => setActiveTab('messages')}
            data-testid="nav-messages"
          >
            <div className="relative">
              <MessageSquare className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-thrst-accent border border-black/50" />
              )}
            </div>
            <span className="text-xs">Messages</span>
          </button>
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'workouts' ? 'text-thrst-accent' : 'text-muted-foreground'} ${activeTab === 'workouts' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-thrst-accent after:shadow-[0_0_8px_var(--thrst-accent)]' : ''}`}
            onClick={() => setActiveTab('workouts')}
            data-testid="nav-workouts"
          >
            <Dumbbell className="h-5 w-5" />
            <span className="text-xs">Exercises</span>
          </button>
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'progress' ? 'text-thrst-accent' : 'text-muted-foreground'} ${activeTab === 'progress' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-thrst-accent after:shadow-[0_0_8px_var(--thrst-accent)]' : ''}`}
            onClick={() => setActiveTab('progress')}
            data-testid="nav-progress"
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Progress</span>
          </button>
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'profile' ? 'text-thrst-accent' : 'text-muted-foreground'} ${activeTab === 'profile' ? 'relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-thrst-accent after:shadow-[0_0_8px_var(--thrst-accent)]' : ''}`}
            onClick={() => setActiveTab('profile')}
            data-testid="nav-profile"
          >
            <User className="h-5 w-5" />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>

      {/* Complete Workout Dialog */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark workout as completed</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input id="duration" type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 45" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea id="notes" className="w-full bg-background border border-white/10 rounded-md p-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? Any adjustments?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button onClick={submitComplete} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500">Passwords do not match.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (!currentPassword || !newPassword || newPassword !== confirmPassword) return;
                changePasswordMutation.mutate({ currentPassword, newPassword });
              }} 
              disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
            >
              {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}