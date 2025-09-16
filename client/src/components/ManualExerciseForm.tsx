import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';

interface WorkoutEntry {
  exercise?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
}

interface ManualExerciseFormProps {
  onAddExercise: (exercise: WorkoutEntry) => void;
}

const commonExercises = [
  'Push-ups', 'Pull-ups', 'Squats', 'Deadlifts', 'Bench Press', 'Overhead Press',
  'Barbell Row', 'Dumbbell Curl', 'Tricep Dips', 'Leg Press', 'Lat Pulldown',
  'Bicep Curl', 'Tricep Extension', 'Shoulder Press', 'Lateral Raise', 'Leg Curl',
  'Leg Extension', 'Calf Raise', 'Plank', 'Crunches', 'Russian Twist', 'Lunges',
  'Running', 'Cycling', 'Swimming', 'Jump Rope', 'Burpees'
];

export function ManualExerciseForm({ onAddExercise }: ManualExerciseFormProps) {
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

    const handleExerciseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setExercise(value);

    if (value.length > 1) {
      const filteredSuggestions = commonExercises.filter(ex =>
        ex.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setExercise(suggestion);
    setSuggestions([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!exercise.trim()) {
      return;
    }

    const entry: WorkoutEntry = {
      exercise: exercise.trim(),
      sets: sets ? parseInt(sets) : undefined,
      reps: reps ? parseInt(reps) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      duration: duration ? parseInt(duration) : undefined,
    };

    onAddExercise(entry);

    // Reset form
    setExercise('');
    setSets('');
    setReps('');
    setWeight('');
    setDuration('');
    setSuggestions([]);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 relative">
              <Label htmlFor="exercise">Exercise Name *</Label>
              <Input
                id="exercise"
                type="text"
                placeholder="e.g., Push-ups, Bench Press, Squats"
                value={exercise}
                onChange={handleExerciseChange}
                onBlur={() => setTimeout(() => setSuggestions([]), 100)}
                required
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-background border border-muted rounded-md mt-1 shadow-lg">
                  <ul className="max-h-40 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className="px-3 py-2 cursor-pointer hover:bg-muted"
                        onMouseDown={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div>
              <Label htmlFor="sets">Sets</Label>
              <Input
                id="sets"
                type="number"
                placeholder="3"
                min="1"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="reps">Reps</Label>
              <Input
                id="reps"
                type="number"
                placeholder="12"
                min="1"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="50"
                min="0"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="30"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-thrst-accent hover:bg-thrst-accent/90 text-black font-semibold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
