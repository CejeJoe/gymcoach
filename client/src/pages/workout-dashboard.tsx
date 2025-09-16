import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { AuthUser } from '@/lib/types';
import { Calendar, Clock, User, Dumbbell, TrendingUp } from 'lucide-react';

interface WorkoutEntry {
  id: string;
  exercise: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  timestamp: string;
  rawText: string;
  userId: string;
}

interface WorkoutSession {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
}

interface ClientWorkoutSummary {
  client: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  recentEntries: WorkoutEntry[];
  lastSession: WorkoutSession | null;
  totalWorkouts: number;
}

interface WorkoutDashboardProps {
  user: AuthUser;
}

export default function WorkoutDashboard({ user }: WorkoutDashboardProps) {
  const [clientSummaries, setClientSummaries] = useState<ClientWorkoutSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user.role === 'coach') {
      fetchClientWorkoutSummaries();
    } else {
      fetchMyWorkoutHistory();
    }
  }, [user]);

  const fetchClientWorkoutSummaries = async () => {
    try {
      const response = await fetch('/api/workouts/client-summaries', {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setClientSummaries(data.clientSummaries || []);
      }
    } catch (error) {
      console.error('Error fetching client workout summaries:', error);
      toast({
        title: "Error",
        description: "Failed to load client workout data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyWorkoutHistory = async () => {
    try {
      const response = await fetch('/api/workouts/history', {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        // For clients, show their own workout data
        setClientSummaries([{
          client: {
            id: user.id,
            user: {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
            }
          },
          recentEntries: data.entries || [],
          lastSession: data.sessions?.[0] || null,
          totalWorkouts: data.entries?.length || 0
        }]);
      }
    } catch (error) {
      console.error('Error fetching workout history:', error);
      toast({
        title: "Error",
        description: "Failed to load workout history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSessionDuration = (session: WorkoutSession) => {
    if (!session.endTime) return 'Active';
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    return `${minutes} min`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {user.role === 'coach' ? 'Client Workouts' : 'My Workouts'}
            </h1>
            <p className="text-muted-foreground">
              {user.role === 'coach' 
                ? 'Monitor your clients\' workout progress and voice-logged exercises'
                : 'View your workout history and progress'
              }
            </p>
          </div>
          {user.role === 'client' && (
            <Button 
              onClick={() => window.location.href = '/workout-logging?mode=voice'}
              className="bg-primary hover:bg-primary/90"
            >
              <Dumbbell className="h-4 w-4 mr-2" />
              Start Workout
            </Button>
          )}
        </div>

        {/* Client/User Workout Summaries */}
        {clientSummaries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {user.role === 'coach' ? 'No client workouts yet' : 'No workouts logged yet'}
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                {user.role === 'coach' 
                  ? 'Your clients haven\'t started logging workouts with voice input yet.'
                  : 'Start your first workout session with voice logging!'
                }
              </p>
              {user.role === 'client' && (
                <Button onClick={() => window.location.href = '/workout-logging?mode=voice'}>
                  <Dumbbell className="h-4 w-4 mr-2" />
                  Start First Workout
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {clientSummaries.map((summary) => (
              <Card key={summary.client.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {summary.client.user.firstName} {summary.client.user.lastName}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {summary.totalWorkouts} exercises logged
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {summary.lastSession && (
                        <Badge variant={summary.lastSession.isActive ? "default" : "secondary"}>
                          {summary.lastSession.isActive ? "Active Session" : "Last Session"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Last Session Info */}
                  {summary.lastSession && (
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {formatDate(summary.lastSession.startTime)}
                      </span>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {getSessionDuration(summary.lastSession)}
                      </span>
                    </div>
                  )}

                  {/* Recent Exercises */}
                  {summary.recentEntries.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Recent Exercises
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {summary.recentEntries.slice(0, 10).map((entry) => (
                          <div 
                            key={entry.id}
                            className="flex items-center justify-between p-2 bg-background border rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium capitalize">{entry.exercise}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(entry.timestamp)}
                                </span>
                              </div>
                              <div className="flex gap-3 text-sm text-muted-foreground">
                                {entry.reps && <span>{entry.reps} reps</span>}
                                {entry.sets && <span>{entry.sets} sets</span>}
                                {entry.weight && <span>{entry.weight} kg</span>}
                                {entry.duration && <span>{entry.duration} min</span>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 italic">
                                "{entry.rawText}"
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.recentEntries.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No exercises logged yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
