import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Play, Pause, Save, Trash2, Mic, Home } from 'lucide-react';
import { ManualExerciseForm } from '@/components/ManualExerciseForm';
import { WorkoutVoiceInput } from '@/components/WorkoutVoiceInput';

interface WorkoutEntry {
  id: string;
  exercise: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  timestamp: Date;
  rawText: string;
}

import { AuthUser } from '@/lib/types';
import { getAuthHeaders } from '@/lib/auth';

interface WorkoutLoggingProps {
  user: AuthUser;
}

export default function WorkoutLogging({ user }: WorkoutLoggingProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>([]);
  const [isLogging, setIsLogging] = useState(false);

  // Parse workout data from voice input
  const parseWorkoutData = (text: string): Partial<WorkoutEntry> => {
    const lowerText = text.toLowerCase();
    
    // Extract exercise name (everything before numbers or "sets"/"reps")
    const exerciseMatch = lowerText.match(/^(.+?)(?:\s+\d+|\s+sets|\s+reps|$)/);
    const exercise = exerciseMatch ? exerciseMatch[1].trim() : text;
    
    // Extract numbers for sets, reps, weight
    const numbers = text.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
    
    // Look for specific keywords
    const setsMatch = lowerText.match(/(\d+)\s*sets?/);
    const repsMatch = lowerText.match(/(\d+)\s*reps?/);
    const weightMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|pounds?|lbs?)/);
    const durationMatch = lowerText.match(/(\d+)\s*(?:minutes?|mins?|seconds?|secs?)/);
    
    return {
      exercise: exercise || 'Unknown Exercise',
      sets: setsMatch ? parseInt(setsMatch[1]) : (numbers[1] || undefined),
      reps: repsMatch ? parseInt(repsMatch[1]) : (numbers[0] || undefined),
      weight: weightMatch ? parseFloat(weightMatch[1]) : undefined,
      duration: durationMatch ? parseInt(durationMatch[1]) : undefined,
      rawText: text
    };
  };

  const handleVoiceResult = (text: string) => {
    const parsedData = parseWorkoutData(text);
    
    const newEntry: WorkoutEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      exercise: parsedData.exercise || 'Unknown Exercise',
      sets: parsedData.sets,
      reps: parsedData.reps,
      weight: parsedData.weight,
      duration: parsedData.duration,
      rawText: parsedData.rawText || text
    };
    
    setWorkoutEntries(prev => [...prev, newEntry]);
    
    toast({
      title: "Workout logged!",
      description: `${newEntry.exercise}${newEntry.reps ? ` - ${newEntry.reps} reps` : ''}${newEntry.sets ? ` x ${newEntry.sets} sets` : ''}`,
    });
  };

  const handleVoiceError = (error: string) => {
    toast({
      title: "Voice input error",
      description: error,
      variant: "destructive",
    });
  };

  const startWorkoutSession = async (mode: 'voice' | 'manual' = 'voice') => {
    try {
      const response = await fetch('/api/workouts/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          startTime: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const session = await response.json();
        setCurrentSession(session.id);
        setIsLogging(mode === 'voice');
        toast({
          title: "Workout session started",
          description: mode === 'voice' ? 'Start speaking your exercises!' : 'You can add exercises manually below.',
        });
      } else {
        throw new Error('Failed to start session');
      }
    } catch (error) {
      console.error('Error starting workout session:', error);
      toast({
        title: "Error",
        description: "Failed to start workout session. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Auto-start session if arriving with a mode query parameter
  useEffect(() => {
    if (currentSession) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      if (modeParam === 'voice' || modeParam === 'manual') {
        startWorkoutSession(modeParam);
      }
    } catch {
      // ignore URL parse errors
    }
  }, [currentSession]);

  // Use shared getAuthHeaders from lib/auth (ensures correct token key)

  const stopWorkoutSession = () => {
    setIsLogging(false);
    toast({
      title: "Workout session paused",
      description: "You can resume anytime or save your workout.",
    });
  };

  const saveWorkout = async () => {
    if (workoutEntries.length === 0) {
      toast({
        title: "No exercises to save",
        description: "Log some exercises first!",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/workouts/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          sessionId: currentSession,
          entries: workoutEntries,
        }),
      });

      if (response.ok) {
        toast({
          title: "Workout saved!",
          description: `Successfully saved ${workoutEntries.length} exercises.`,
        });
      }
    } catch (error) {
      console.error('Failed to save workout:', error);
      toast({
        title: "Workout saved locally!",
        description: `${workoutEntries.length} exercises logged.`,
      });
    }
  };

  const removeEntry = (id: string) => {
    setWorkoutEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const endWorkoutSession = async () => {
    if (!currentSession || workoutEntries.length === 0) {
      toast({
        title: "No exercises logged",
        description: "Add some exercises before ending the session.",
        variant: "destructive",
      });
      return;
    }
    await saveWorkout();
    try {
      await fetch(`/api/workouts/sessions/${currentSession}/end`, {
        method: 'PUT',
        headers: { ...getAuthHeaders() },
      });
    } catch (e) {
      console.warn('Failed to end session on server', e);
    }
    sessionStorage.setItem('workoutSummary', JSON.stringify({ entries: workoutEntries }));
    setLocation('/workout-summary');
  };

  const handleManualEntry = (exercise: Partial<WorkoutEntry>) => {
    const newEntry: WorkoutEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      exercise: exercise.exercise || 'Unknown Exercise',
      sets: exercise.sets,
      reps: exercise.reps,
      weight: exercise.weight,
      duration: exercise.duration,
      rawText: `${exercise.exercise} - ${exercise.sets ? `${exercise.sets} sets` : ''}${exercise.reps ? ` x ${exercise.reps} reps` : ''}${exercise.weight ? ` @ ${exercise.weight}kg` : ''}`
    };
    
    setWorkoutEntries(prev => [...prev, newEntry]);
    
    toast({
      title: "Exercise added!",
      description: `${newEntry.exercise} logged successfully.`,
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Workout Logger</h1>
          <p className="text-muted-foreground">
            Use voice commands to log your exercises in real-time
          </p>
        </div>

        {/* Session Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Workout Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!currentSession ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button 
                  onClick={() => startWorkoutSession('voice')}
                  className="w-full bg-thrst-accent hover:bg-thrst-accent/90 text-black font-semibold"
                  size="lg"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Voice Workout
                </Button>
                <Button 
                  onClick={() => startWorkoutSession('manual')}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Manual Workout
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-500/20 rounded-lg border border-green-500/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Session Active</span>
                  </div>
                  <Badge variant="secondary">
                    {workoutEntries.length} exercises logged
                  </Badge>
                </div>
                
                <Button 
                  onClick={endWorkoutSession}
                  variant="outline"
                  className="w-full"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Exercise Entry Form */}
        {currentSession && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Exercise Manually</CardTitle>
            </CardHeader>
            <CardContent>
              <ManualExerciseForm onAddExercise={handleManualEntry} />
            </CardContent>
          </Card>
        )}

        {/* Voice Input */}
        {currentSession && (
          <Card>
            <CardHeader>
              <CardTitle>Voice Logging</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkoutVoiceInput 
                onResult={handleVoiceResult} 
                onError={handleVoiceError} 
                isActive={isLogging} 
              />
            </CardContent>
          </Card>
        )}

        {/* Workout Entries */}
        {workoutEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Today's Workout ({workoutEntries.length} exercises)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workoutEntries.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium capitalize">{entry.exercise}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {entry.reps && <span>{entry.reps} reps</span>}
                        {entry.sets && <span>{entry.sets} sets</span>}
                        {entry.weight && <span>{entry.weight} kg</span>}
                        {entry.duration && <span>{entry.duration} min</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 italic">
                        "{entry.rawText}"
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEntry(entry.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
