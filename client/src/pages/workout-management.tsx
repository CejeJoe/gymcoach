import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GlassCard } from "@/components/ui/glass-card";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ClientData, WorkoutData, AuthUser } from "@/lib/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Dumbbell, 
  Calendar, 
  Clock, 
  CheckCircle,
  Users,
  Timer,
  Target
} from "lucide-react";

interface WorkoutManagementProps {
  user: AuthUser;
}

const workoutFormSchema = z.object({
  name: z.string().min(1, "Workout name is required"),
  description: z.string().optional(),
  clientId: z.string().min(1, "Client selection is required"),
  scheduledDate: z.string().optional(),
  exercises: z.array(z.object({
    name: z.string(),
    sets: z.number().min(1),
    reps: z.number().min(1),
    weight: z.number().optional(),
  })).min(1, "At least one exercise is required"),
});

type WorkoutFormData = z.infer<typeof workoutFormSchema>;

export default function WorkoutManagement({ user }: WorkoutManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [exercises, setExercises] = useState([{ name: "", sets: 1, reps: 1, weight: 0 }]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients } = useQuery<ClientData[]>({
    queryKey: ['/api/coach/clients'],
    queryFn: async () => {
      const response = await fetch('/api/coach/clients', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
  });

  const { data: workouts, isLoading } = useQuery<WorkoutData[]>({
    queryKey: ['/api/coach/workouts'],
    queryFn: async () => {
      const response = await fetch('/api/coach/workouts', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch workouts');
      return response.json();
    },
  });

  const createWorkoutMutation = useMutation({
    mutationFn: async (data: WorkoutFormData) => {
      const response = await fetch('/api/coach/workouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          clientId: data.clientId,
          coachId: user.id,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate).toISOString() : null,
          exercises: exercises.filter(ex => ex.name.trim() !== ''),
          isCompleted: false,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create workout');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coach/stats'] });
      setIsAddDialogOpen(false);
      form.reset();
      setExercises([{ name: "", sets: 1, reps: 1, weight: 0 }]);
      toast({
        title: "Success",
        description: "Workout created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create workout",
        variant: "destructive",
      });
    },
  });

  const form = useForm<WorkoutFormData>({
    resolver: zodResolver(workoutFormSchema),
    defaultValues: {
      name: "",
      description: "",
      clientId: "",
      scheduledDate: "",
      exercises: [{ name: "", sets: 1, reps: 1, weight: 0 }],
    },
  });

  const onSubmit = (data: WorkoutFormData) => {
    createWorkoutMutation.mutate({
      ...data,
      exercises: exercises.filter(ex => ex.name.trim() !== ''),
    });
  };

  const addExercise = () => {
    setExercises([...exercises, { name: "", sets: 1, reps: 1, weight: 0 }]);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, field: string, value: any) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-thrst-green"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workout Management</h1>
          <p className="text-muted-foreground">Create and track workout plans for your clients</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-thrst-green hover:bg-thrst-green/90" data-testid="button-add-workout">
              <Plus className="h-4 w-4 mr-2" />
              Create Workout
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-morphism border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Workout</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workout Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Chest & Triceps" data-testid="input-workout-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-client">
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients?.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.user?.firstName} {client.user?.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scheduled Date</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-scheduled-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Workout notes and instructions..." data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Exercises */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Exercises</Label>
                    <Button type="button" onClick={addExercise} size="sm" variant="outline">
                      <Plus className="h-3 w-3 mr-1" />
                      Add Exercise
                    </Button>
                  </div>
                  
                  {exercises.map((exercise, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Label className="text-xs">Exercise Name</Label>
                        <Input
                          value={exercise.name}
                          onChange={(e) => updateExercise(index, 'name', e.target.value)}
                          placeholder="e.g., Bench Press"
                          data-testid={`input-exercise-name-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Sets</Label>
                        <Input
                          type="number"
                          min="1"
                          value={exercise.sets}
                          onChange={(e) => updateExercise(index, 'sets', parseInt(e.target.value) || 1)}
                          data-testid={`input-sets-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Reps</Label>
                        <Input
                          type="number"
                          min="1"
                          value={exercise.reps}
                          onChange={(e) => updateExercise(index, 'reps', parseInt(e.target.value) || 1)}
                          data-testid={`input-reps-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Weight (kg)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={exercise.weight || ''}
                          onChange={(e) => updateExercise(index, 'weight', parseFloat(e.target.value) || 0)}
                          data-testid={`input-weight-${index}`}
                        />
                      </div>
                      <div className="col-span-1">
                        {exercises.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExercise(index)}
                            className="text-thrst-accent"
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-thrst-green hover:bg-thrst-green/90"
                    disabled={createWorkoutMutation.isPending}
                    data-testid="button-save-workout"
                  >
                    {createWorkoutMutation.isPending ? "Creating..." : "Create Workout"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workouts Grid */}
      <div className="grid gap-4">
        {workouts?.map((workout) => (
          <GlassCard key={workout.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <Dumbbell className="h-5 w-5 text-thrst-green" />
                  <h3 className="font-semibold" data-testid={`text-workout-name-${workout.id}`}>
                    {workout.name}
                  </h3>
                  <Badge variant={workout.completedAt ? "secondary" : "outline"}>
                    {workout.completedAt ? "Completed" : "Scheduled"}
                  </Badge>
                </div>
                
                {workout.description && (
                  <p className="text-sm text-muted-foreground mb-2">{workout.description}</p>
                )}

                <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                  {workout.scheduledDate && (
                    <span className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(workout.scheduledDate).toLocaleDateString()}
                    </span>
                  )}
                  {workout.duration && (
                    <span className="flex items-center">
                      <Timer className="h-3 w-3 mr-1" />
                      {workout.duration} min
                    </span>
                  )}
                  <span className="flex items-center">
                    <Target className="h-3 w-3 mr-1" />
                    {workout.exercises?.length || 0} exercises
                  </span>
                </div>

                {/* Exercise List */}
                <div className="space-y-1">
                  {workout.exercises?.slice(0, 3).map((exercise: any, index: number) => (
                    <div key={index} className="text-xs text-muted-foreground">
                      {exercise.name} - {exercise.sets}x{exercise.reps}
                      {exercise.weight && ` @ ${exercise.weight}kg`}
                    </div>
                  ))}
                  {workout.exercises && workout.exercises.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{workout.exercises.length - 3} more exercises
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end space-y-2">
                {!workout.completedAt && (
                  <Button 
                    size="sm" 
                    className="bg-thrst-green/20 hover:bg-thrst-green/30 text-thrst-green"
                    data-testid={`button-complete-${workout.id}`}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete
                  </Button>
                )}
              </div>
            </div>
          </GlassCard>
        )) || (
          <div className="text-center py-12">
            <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workouts yet</h3>
            <p className="text-muted-foreground mb-4">Create workout plans for your clients</p>
            <Button 
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-thrst-green hover:bg-thrst-green/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Workout
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}