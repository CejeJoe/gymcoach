import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Dumbbell, Timer, Flame } from 'lucide-react';
import { AuthUser } from '@/lib/types';

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

interface WorkoutSummaryProps {
  user: AuthUser;
}

export default function WorkoutSummary({ user }: WorkoutSummaryProps) {
  const [, setLocation] = useLocation();
  const [summary, setSummary] = useState<{ entries: WorkoutEntry[] } | null>(null);

  useEffect(() => {
    const summaryData = sessionStorage.getItem('workoutSummary');
    if (summaryData) {
      setSummary(JSON.parse(summaryData));
      sessionStorage.removeItem('workoutSummary');
    } else {
      setLocation('/');
    }
  }, [setLocation]);

  if (!summary) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading summary...</p>
      </div>
    );
  }

  const { entries } = summary;
  const totalExercises = entries.length;
  const totalDuration = entries.reduce((acc, entry) => acc + (entry.duration || 0), 0);
  const totalSets = entries.reduce((acc, entry) => acc + (entry.sets || 0), 0);
  const totalWeight = entries.reduce((acc, entry) => acc + ((entry.reps || 0) * (entry.sets || 0) * (entry.weight || 0)), 0);

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-3xl font-bold">Workout Complete!</h1>
        <p className="text-muted-foreground">
          Great job! Here's a summary of your session.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Session Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <Dumbbell className="h-8 w-8 mx-auto text-thrst-accent" />
                <p className="text-2xl font-bold mt-2">{totalExercises}</p>
                <p className="text-sm text-muted-foreground">Exercises</p>
              </div>
              <div>
                <Timer className="h-8 w-8 mx-auto text-thrst-accent" />
                <p className="text-2xl font-bold mt-2">{totalDuration}</p>
                <p className="text-sm text-muted-foreground">Minutes</p>
              </div>
              <div>
                <p className="text-2xl font-bold mt-2">{totalSets}</p>
                <p className="text-sm text-muted-foreground">Total Sets</p>
              </div>
              <div>
                <Flame className="h-8 w-8 mx-auto text-thrst-accent" />
                <p className="text-2xl font-bold mt-2">{totalWeight.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Volume (kg)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logged Exercises</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-left">
              {entries.map(entry => (
                <li key={entry.id} className="p-2 bg-muted/50 rounded-md">
                  <p className="font-semibold">{entry.exercise}</p>
                  <p className="text-sm text-muted-foreground">
                    {entry.sets && `${entry.sets} sets`}{entry.reps && ` x ${entry.reps} reps`}{entry.weight && ` @ ${entry.weight}kg`}{entry.duration && `${entry.duration} min`}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Button onClick={() => setLocation('/')} size="lg" className="w-full">
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
