import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useTheme } from "@/components/ui/theme-provider";
import { getAuthHeaders } from "@/lib/auth";
import { ClientStats, WorkoutData, ProgressData, AuthUser } from "@/lib/types";
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
  Camera,
  Calendar
} from "lucide-react";

interface ClientPortalProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function ClientPortal({ user, onLogout }: ClientPortalProps) {
  const { theme, setTheme } = useTheme();

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

  // Mock today's workout data
  const todayWorkout = {
    name: "Upper Body Strength",
    exercises: [
      { id: "1", name: "Bench Press", sets: 3, reps: 12, completed: true },
      { id: "2", name: "Pull Ups", sets: 3, reps: 8, completed: false },
      { id: "3", name: "Shoulder Press", sets: 3, reps: 10, completed: false },
    ]
  };

  const progressPercentage = 78;
  const daysLeft = 12;

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
            <img 
              src={user.avatar || "https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"}
              alt="Profile photo" 
              className="w-12 h-12 rounded-xl object-cover"
            />
            <div>
              <h1 className="font-bold text-lg">Welcome {user.firstName}!</h1>
              <p className="text-xs text-muted-foreground">Ready to crush today?</p>
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
        {/* Progress Overview */}
        <GlassCard gradient>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Your Progress</h3>
            <div className="text-thrst-green font-bold text-2xl" data-testid="text-progress-percentage">
              {progressPercentage}%
            </div>
          </div>
          
          {/* Progress Ring */}
          <div className="flex justify-center mb-4">
            <ProgressRing progress={progressPercentage} size={128}>
              <div className="text-center">
                <div className="text-xl font-bold" data-testid="text-days-left">{daysLeft}</div>
                <div className="text-xs text-muted-foreground">days left</div>
              </div>
            </ProgressRing>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Summer Body Challenge</p>
            <p className="text-xs mt-1">You're doing amazing! 💪</p>
          </div>
        </GlassCard>

        {/* Today's Workout */}
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Today's Workout</h3>
            <Badge className="bg-thrst-green/20 text-thrst-green border-thrst-green/30">
              Upper Body
            </Badge>
          </div>
          
          <div className="space-y-3">
            {todayWorkout.exercises.map((exercise) => (
              <div 
                key={exercise.id}
                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  exercise.completed 
                    ? 'bg-thrst-green/10 border border-thrst-green/30' 
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    exercise.completed ? 'bg-thrst-green/20' : 'bg-muted'
                  }`}>
                    <Dumbbell className={`h-4 w-4 ${exercise.completed ? 'text-thrst-green' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="font-medium text-sm" data-testid={`text-exercise-${exercise.id}`}>
                      {exercise.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {exercise.sets} sets × {exercise.reps} reps
                    </div>
                  </div>
                </div>
                <button className={exercise.completed ? 'text-thrst-green' : 'text-muted-foreground'}>
                  {exercise.completed ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </button>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <GlassCard>
            <div className="text-center">
              <div className="text-lg font-bold text-thrst-green" data-testid="text-workouts-count">
                {stats?.completedWorkouts || 15}
              </div>
              <div className="text-xs text-muted-foreground">Workouts</div>
            </div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-center">
              <div className="text-lg font-bold text-thrst-accent" data-testid="text-weight-lost">
                5.2kg
              </div>
              <div className="text-xs text-muted-foreground">Lost</div>
            </div>
          </GlassCard>
          
          <GlassCard>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-500" data-testid="text-days-active">
                {stats?.daysActive || 28}
              </div>
              <div className="text-xs text-muted-foreground">Days</div>
            </div>
          </GlassCard>
        </div>

        {/* Progress Photos */}
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Progress Photos</h3>
            <Button variant="ghost" size="sm" className="text-thrst-green">
              View All
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <img 
              src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200" 
              alt="Progress photo" 
              className="w-full h-20 object-cover rounded-lg"
            />
            <img 
              src="https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200" 
              alt="Progress photo" 
              className="w-full h-20 object-cover rounded-lg"
            />
            <div className="w-full h-20 bg-muted rounded-lg flex items-center justify-center">
              <Camera className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </GlassCard>

        {/* Weekly Goals */}
        <GlassCard>
          <h3 className="font-semibold mb-4">Weekly Goals</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Workout Sessions</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">4/5</span>
                <div className="w-16 h-2 bg-muted rounded-full">
                  <div className="w-4/5 h-full bg-thrst-green rounded-full"></div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Protein Goal</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">120g/150g</span>
                <div className="w-16 h-2 bg-muted rounded-full">
                  <div className="w-4/5 h-full bg-thrst-accent rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton data-testid="floating-add-button" />

      {/* Bottom Navigation */}
      <nav className="glass-morphism fixed bottom-0 left-0 right-0 p-4 border-t border-white/10">
        <div className="flex justify-around">
          <button className="flex flex-col items-center space-y-1 text-thrst-green" data-testid="nav-home">
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-muted-foreground" data-testid="nav-workouts">
            <Dumbbell className="h-5 w-5" />
            <span className="text-xs">Workouts</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-muted-foreground" data-testid="nav-progress">
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Progress</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-muted-foreground" data-testid="nav-profile">
            <User className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
