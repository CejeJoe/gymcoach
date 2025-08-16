import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { useTheme } from "@/components/ui/theme-provider";
import { getAuthHeaders } from "@/lib/auth";
import { ClientStats, WorkoutData, AuthUser } from "@/lib/types";
import { 
  Home, 
  Dumbbell, 
  TrendingUp, 
  User, 
  Moon, 
  Sun, 
  LogOut,
  CheckCircle,
  Circle,
  Calendar,
  Target
} from "lucide-react";

interface ClientPortalProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function ClientPortal({ user, onLogout }: ClientPortalProps) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("home");

  const { data: stats, isLoading: statsLoading } = useQuery<ClientStats>({
    queryKey: ['/api/client/stats'],
    queryFn: async () => {
      const response = await fetch('/api/client/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const { data: workouts, isLoading: workoutsLoading } = useQuery<WorkoutData[]>({
    queryKey: ['/api/client/workouts'],
    queryFn: async () => {
      const response = await fetch('/api/client/workouts', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch workouts');
      return response.json();
    },
  });

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (statsLoading || workoutsLoading) {
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

      {/* Tab Content */}
      {activeTab === "home" && (
        <div className="p-4 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-3 text-center">
            <div className="text-lg font-bold text-thrst-green">
              {stats?.totalWorkouts || 0}
            </div>
            <div className="text-xs text-muted-foreground">Workouts</div>
          </GlassCard>
          
          <GlassCard className="p-3 text-center">
            <div className="text-lg font-bold text-blue-400">
              {stats?.completedWorkouts || 0}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </GlassCard>

          <GlassCard className="p-3 text-center">
            <div className="text-lg font-bold text-purple-400">
              {7}
            </div>
            <div className="text-xs text-muted-foreground">Day Streak</div>
          </GlassCard>
        </div>

        {/* Current Progress */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Current Goal Progress</h3>
            <Badge variant="secondary" className="bg-thrst-green/10 text-thrst-green">
              78% Complete
            </Badge>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-2">
            <div className="h-2 bg-thrst-green rounded-full" style={{ width: '78%' }}></div>
          </div>
          <p className="text-sm text-muted-foreground">12 days left in current program</p>
        </GlassCard>

        {/* Today's Workout */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-thrst-green" />
              Today's Workout
            </h3>
            <Button size="sm" className="bg-thrst-green/20 hover:bg-thrst-green/30 text-thrst-green">
              Start
            </Button>
          </div>
          
          {workouts && workouts.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium">{workouts[0]?.name || "Upper Body Strength"}</h4>
              {(workouts[0]?.exercises || [
                { name: "Bench Press", sets: 3, reps: 12 },
                { name: "Pull Ups", sets: 3, reps: 8 },
                { name: "Shoulder Press", sets: 3, reps: 10 }
              ]).slice(0, 3).map((exercise: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 glass-morphism rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{exercise.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {exercise.sets}x{exercise.reps}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No workouts scheduled for today</p>
              <p className="text-sm text-muted-foreground">Check back tomorrow or contact your coach</p>
            </div>
          )}
        </GlassCard>

        {/* Recent Activity */}
        <GlassCard className="p-4">
          <h3 className="font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-4 w-4 text-thrst-green" />
                <span className="text-sm">Completed Upper Body workout</span>
              </div>
              <span className="text-xs text-muted-foreground">Yesterday</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Updated weight goal</span>
              </div>
              <span className="text-xs text-muted-foreground">3 days ago</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Scheduled new workout plan</span>
              </div>
              <span className="text-xs text-muted-foreground">1 week ago</span>
            </div>
          </div>
        </GlassCard>
        </div>
      )}

      {activeTab === "workouts" && (
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">My Workouts</h2>
          {workouts && workouts.length > 0 ? (
            <div className="space-y-4">
              {workouts.map((workout) => (
                <GlassCard key={workout.id} className="p-4">
                  <h3 className="font-semibold">{workout.name}</h3>
                  <p className="text-sm text-muted-foreground">{workout.description}</p>
                  <div className="mt-2 flex justify-between items-center">
                    <Badge variant={workout.completedAt ? "default" : "secondary"}>
                      {workout.completedAt ? "Completed" : "Pending"}
                    </Badge>
                    <Button size="sm">View Details</Button>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Workouts Yet</h3>
              <p className="text-muted-foreground">Your coach will assign workouts soon</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "progress" && (
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Progress Tracking</h2>
          <div className="space-y-4">
            <GlassCard className="p-4">
              <h3 className="font-semibold mb-2">Weight Progress</h3>
              <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-muted-foreground">Chart coming soon</p>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <h3 className="font-semibold mb-2">Workout Streak</h3>
              <div className="text-center">
                <div className="text-3xl font-bold text-thrst-green">{7}</div>
                <p className="text-sm text-muted-foreground">Days in a row</p>
              </div>
            </GlassCard>
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
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="glass-morphism fixed bottom-0 left-0 right-0 p-2 border-t border-white/10">
        <div className="flex justify-around max-w-md mx-auto">
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'home' ? 'text-thrst-green' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('home')}
            data-testid="nav-home"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
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
            className={`flex flex-col items-center space-y-1 ${activeTab === 'progress' ? 'text-thrst-green' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('progress')}
            data-testid="nav-progress"
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Progress</span>
          </button>
          <button 
            className={`flex flex-col items-center space-y-1 ${activeTab === 'profile' ? 'text-thrst-green' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('profile')}
            data-testid="nav-profile"
          >
            <User className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}