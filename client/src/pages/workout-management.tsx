import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GlassCard } from "@/components/ui/glass-card";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ClientData, WorkoutData, AuthUser } from "@/lib/types";
import { useForm, useFieldArray } from "react-hook-form";
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
  Target,
  Loader2
} from "lucide-react";
import { WorkoutImport } from '@/components/workout/WorkoutImport';

interface WorkoutManagementProps {
  user: AuthUser;
}

const workoutFormSchema = z.object({
  name: z.string().min(1, "Workout name is required"),
  description: z.string().optional(),
  clientId: z.string().min(1, "Client selection is required"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  exercises: z.array(z.object({
    name: z.string().min(1, "Exercise name is required"),
    sets: z.number().min(1, "At least 1 set is required"),
    reps: z.number().min(1, "At least 1 rep is required"),
    weight: z.number().optional(),
  })).min(1, "At least one exercise is required"),
});

type WorkoutFormData = z.infer<typeof workoutFormSchema>;

export default function WorkoutManagement({ user }: WorkoutManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Helper to format Date to 'YYYY-MM-DDTHH:mm' in LOCAL time for <input type="datetime-local">
  const formatLocalDateTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  // Template utilities (localStorage)
  type WorkoutTemplate = {
    id: string;
    name: string;
    description?: string;
    exercises: { name: string; sets: number; reps: number; weight?: number | null }[];
  };

  const TEMPLATE_KEY = 'gc_workout_templates';
  const readTemplates = (): WorkoutTemplate[] => {
    try {
      return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
    } catch { return []; }
  };
  const writeTemplates = (arr: WorkoutTemplate[]) => {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(arr));
  };

  const handleCompleteWorkout = async (workoutId: string) => {
    try {
      const response = await fetch(`/api/coach/workouts/${workoutId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          duration: 45,
          notes: 'Completed successfully'
        }),
      });

      if (!response.ok) throw new Error('Failed to complete workout');
      
      queryClient.invalidateQueries({ queryKey: ['/api/coach/workouts'] });
      toast({ title: 'Workout completed', description: 'Workout marked as completed successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to complete workout. Please try again.', variant: 'destructive' });
    }
  };

  const handleSaveAsTemplate = (w: any) => {
    const templates = readTemplates();
    const t: WorkoutTemplate = {
      id: crypto.randomUUID(),
      name: w.name || 'Untitled Template',
      description: w.description || '',
      exercises: (w.exercises || []).map((ex: any) => ({
        name: ex.name,
        sets: Number(ex.sets)||1,
        reps: Number(ex.reps)||1,
        weight: typeof ex.weight === 'number' ? ex.weight : null,
      })),
    };
    writeTemplates([t, ...templates].slice(0, 50));
    toast({ title: 'Saved template', description: `Template "${t.name}" saved.` });
  };

  const handleDuplicateWorkout = (w: any) => {
    // Open dialog with form prefilled from workout
    setIsAddDialogOpen(true);
    setTimeout(() => {
      form.reset({
        name: w.name,
        description: w.description || '',
        clientId: String(w.clientId || ''),
        scheduledDate: formatLocalDateTime(new Date()),
        exercises: (w.exercises || []).map((ex: any) => ({
          name: ex.name || '', sets: Number(ex.sets)||1, reps: Number(ex.reps)||1, weight: typeof ex.weight==='number'?ex.weight:0,
        })),
      });
    }, 0);
  };

  const applyTemplateToForm = (tplId: string) => {
    const tpl = readTemplates().find(t => t.id === tplId);
    if (!tpl) return;
    form.setValue('name', tpl.name);
    form.setValue('description', tpl.description || '');
    form.setValue('exercises', tpl.exercises.map(ex => ({ name: ex.name, sets: ex.sets, reps: ex.reps, weight: ex.weight ?? 0 })));
  };

  const { data: clientsData, isFetching: isFetchingClients, refetch: refetchClients } = useQuery({
    queryKey: ['/api/coach/clients'],
    queryFn: async () => {
      const response = await fetch('/api/coach/clients', {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) throw new Error('Failed to fetch clients');
      const data = await response.json();
      // Server returns an array of clients, not an object wrapper
      const arr = Array.isArray(data) ? data : (data?.clients ?? []);
      try { console.debug('Clients loaded:', arr.length); } catch {}
      return arr;
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  
  const clients = Array.isArray(clientsData) ? clientsData : [];
  const effectiveClients: any[] = clients.length > 0 ? clients : ((clientsData as any)?.clients ?? []);

  // Ensure clients are fresh when opening the dialog
  useEffect(() => {
    if (isAddDialogOpen) {
      refetchClients();
    }
  }, [isAddDialogOpen, refetchClients]);

  const { data: workouts, isLoading } = useQuery<WorkoutData[]>({
    queryKey: ['/api/coach/workouts'],
    queryFn: async () => {
      const response = await fetch('/api/coach/workouts', {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) throw new Error('Failed to fetch workouts');
      const data = await response.json();
      const workouts = data.workouts || data; // Handle both formats
      try { 
        console.debug('Workouts API response:', data);
        console.debug('Workouts loaded:', Array.isArray(workouts) ? workouts.length : 0);
        console.debug('Current user:', user);
        if (workouts.length > 0) {
          console.debug('First workout coach ID:', workouts[0].coachId);
          console.debug('Current user ID:', user.id);
        }
      } catch {}
      return Array.isArray(workouts) ? workouts : [];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const createWorkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        console.log('Starting mutation with data:', data);
        const validExercises = (data.exercises || []).filter((ex: any) => ex?.name?.trim() !== '');
        
        if (!data.clientId) {
          throw new Error('Client ID is required');
        }

        const response = await fetch('/api/coach/workouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            ...data,
            exercises: validExercises,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create workout');
        }

        return response.json();
      } catch (error) {
        console.error('Error in mutation:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/workouts'] });
    },
  });

  const form = useForm<WorkoutFormData>({
    resolver: zodResolver(workoutFormSchema),
    defaultValues: {
      name: "",
      description: "",
      clientId: "",
      scheduledDate: formatLocalDateTime(new Date()),
      exercises: [{ name: "", sets: 1, reps: 1, weight: 0 }],
    },
  });

  const { fields: exerciseFields, append: appendExercise, remove: removeExercise } = useFieldArray({
    control: form.control,
    name: "exercises",
  });

  const onSubmit = async (formData: WorkoutFormData) => {
    try {
      console.log('Form submitted with data:', formData);
      
      const workoutData = {
        ...formData,
        // Send as epoch ms to preserve the intended local datetime without timezone shifts
        scheduledDate: new Date(formData.scheduledDate).getTime(),
        exercises: formData.exercises.map(ex => ({
          ...ex,
          sets: Number(ex.sets),
          reps: Number(ex.reps),
          weight: ex.weight !== undefined && ex.weight !== null ? Number(ex.weight) : null,
        })),
      };

      await createWorkoutMutation.mutateAsync(workoutData);
      
      form.reset();
      setIsAddDialogOpen(false);
      
      toast({
        title: "Success!",
        description: "Workout created successfully",
      });
    } catch (error) {
      console.error('Error creating workout:', error);
      toast({
        title: 'Error',
        description: 'Failed to create workout. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-thrst-accent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Workout Management</h1>
          <p className="text-sm text-muted-foreground truncate">Create and track workout plans for your clients</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-thrst-accent hover:bg-thrst-accent/90" data-testid="button-add-workout">
              <Plus className="h-4 w-4 mr-2" />
              Create Workout
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-morphism border-white/10 w-[95vw] max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Workout</DialogTitle>
              <DialogDescription>
                Fill in the details below to create a new workout plan for your client.
              </DialogDescription>
            </DialogHeader>
            {/* Templates quick select */}
            <div className="flex flex-col md:flex-row gap-2 md:items-end">
              <div className="flex-1 min-w-0">
                <Label htmlFor="templateSelect">Load from Template</Label>
                <Select 
                  value={selectedTemplate}
                  onValueChange={(v) => { setSelectedTemplate(v); applyTemplateToForm(v); }}>
                  <SelectTrigger id="templateSelect"><SelectValue placeholder="Choose a template (optional)" /></SelectTrigger>
                  <SelectContent>
                    {readTemplates().length === 0 ? (
                      <SelectItem value="_none" disabled>No templates saved</SelectItem>
                    ) : readTemplates().map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" className="md:self-end" onClick={() => {
                const cur = form.getValues();
                handleSaveAsTemplate({
                  name: cur.name,
                  description: cur.description,
                  exercises: cur.exercises,
                });
              }}>Save as Template</Button>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="workout-name">Workout Name</FormLabel>
                      <FormControl>
                        <Input 
                          id="workout-name"
                          autoComplete="off"
                          {...field} 
                          placeholder="e.g., Chest & Triceps" 
                          data-testid="input-workout-name" 
                        />
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
                      <FormLabel htmlFor="clientId">Client</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} name="clientId" disabled={effectiveClients.length === 0}>
                        <FormControl>
                          <SelectTrigger id="clientId">
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isFetchingClients && (
                            <SelectItem value="loading" disabled>
                              Loading clients...
                            </SelectItem>
                          )}
                          {!isFetchingClients && effectiveClients.length === 0 && (
                            <SelectItem value="empty" disabled>
                              No clients found
                            </SelectItem>
                          )}
                          {!isFetchingClients && effectiveClients.length > 0 && effectiveClients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {
                                ([client.user?.firstName, client.user?.lastName].filter(Boolean).join(' ') ||
                                 client.user?.email ||
                                 (client as any)?.email ||
                                 client.id)
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {effectiveClients.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">No clients available. Ensure you are logged in as a coach and have clients assigned.</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="scheduledDate">Scheduled Date & Time</FormLabel>
                      <FormControl>
                        <Input
                          id="scheduledDate"
                          type="datetime-local"
                          {...field}
                          min={formatLocalDateTime(new Date())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="description">Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          id="description"
                          placeholder="Add any notes or instructions for this workout..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Exercises</Label>
                    <Button type="button" onClick={() => appendExercise({ name: "", sets: 1, reps: 1, weight: 0 })} size="sm" variant="outline">
                      <Plus className="h-3 w-3 mr-1" />
                      Add Exercise
                    </Button>
                  </div>

                  {exerciseFields.map((field, index) => (
                    <div key={field.id} className="space-y-3 p-4 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Exercise {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExercise(index)}
                          className="text-muted-foreground hover:text-destructive"
                          disabled={exerciseFields.length <= 1}
                        >
                          Remove
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name={`exercises.${index}.name`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel htmlFor={`exercises.${index}.name`}>Name</FormLabel>
                              <FormControl>
                                <Input {...field} id={`exercises.${index}.name`} placeholder="e.g., Bench Press" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`exercises.${index}.sets`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel htmlFor={`exercises.${index}.sets`}>Sets</FormLabel>
                              <FormControl>
                                <Input {...field} id={`exercises.${index}.sets`} type="number" min="1" onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`exercises.${index}.reps`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel htmlFor={`exercises.${index}.reps`}>Reps</FormLabel>
                              <FormControl>
                                <Input {...field} id={`exercises.${index}.reps`} type="number" min="1" onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`exercises.${index}.weight`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel htmlFor={`exercises.${index}.weight`}>Weight (kg)</FormLabel>
                              <FormControl>
                                <Input {...field} id={`exercises.${index}.weight`} type="number" min="0" step="0.5" placeholder="0" onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-thrst-accent hover:bg-thrst-accent/90"
                    disabled={createWorkoutMutation.isPending}
                  >
                    {createWorkoutMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : 'Create Workout'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        {/* Import Workout from Samsung Notes / PDF */}
        <WorkoutImport 
          clients={effectiveClients}
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/coach/workouts'] });
          }}
        />
      </div>

      {/* Workouts List */}
      <div className="grid gap-3">
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading workouts...</p>
          </div>
        ) : (workouts && workouts.length > 0) ? workouts.map((workout) => {
          if (!workout || !workout.id) return null;
          return (
          <GlassCard key={workout.id} className="p-3 sm:p-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Dumbbell className="h-5 w-5 text-thrst-accent" />
                  <h3 className="font-semibold truncate" data-testid={`text-workout-name-${workout.id}`}>
                    {workout.name}
                  </h3>
                  <Badge variant={workout.completedAt ? "secondary" : "outline"}>
                    {workout.completedAt ? "Completed" : "Scheduled"}
                  </Badge>
                </div>
                
                {workout.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-3">{workout.description}</p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mb-3">
                  {workout.scheduledDate && (
                    <span className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(workout.scheduledDate).toLocaleDateString()}
                    </span>
                  )}
                  {workout.completedAt && (
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(workout.completedAt).toLocaleString()}
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
                    {Array.isArray(workout.exercises) ? workout.exercises.length : 0} exercises
                  </span>
                </div>

                {/* Exercise List */}
                <div className="space-y-1">
                  {Array.isArray(workout.exercises) && workout.exercises.slice(0, 3).map((exercise: any, index: number) => (
                    <div key={index} className="text-xs text-muted-foreground">
                      {exercise.name} - {exercise.sets}x{exercise.reps || 'N/A'}
                      {exercise.weight && ` @ ${exercise.weight}kg`}
                      {exercise.duration && ` (${exercise.duration}min)`}
                    </div>
                  ))}
                  {Array.isArray(workout.exercises) && workout.exercises.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{workout.exercises.length - 3} more exercises
                    </div>
                  )}
                </div>

                {/* Client Feedback */}
                {(workout.notes || workout.completedAt || workout.duration) && (
                  <div className="mt-3 border-t pt-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Client Feedback</div>
                    {workout.notes && (
                      <p className="text-sm whitespace-pre-wrap" data-testid={`text-workout-notes-${workout.id}`}>
                        {workout.notes}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      {workout.completedAt && (
                        <span className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </span>
                      )}
                      {typeof workout.duration === 'number' && workout.duration > 0 && (
                        <span className="flex items-center">
                          <Timer className="h-3 w-3 mr-1" />
                          {workout.duration} min
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col md:items-end space-y-2">
                {!workout.completedAt && (
                  <Button 
                    size="sm" 
                    className="bg-thrst-accent/20 hover:bg-thrst-accent/30 text-thrst-accent self-start md:self-auto"
                    data-testid={`button-complete-${workout.id}`}
                    onClick={() => handleCompleteWorkout(workout.id)}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete
                  </Button>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handleDuplicateWorkout(workout)}>Duplicate</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleSaveAsTemplate(workout)}>Save as Template</Button>
                </div>
              </div>
            </div>
          </GlassCard>
          );
        }) : (
          <div className="text-center py-12">
            <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workouts yet</h3>
            <p className="text-muted-foreground mb-4">Create workout plans for your clients</p>
            <Button 
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-thrst-accent hover:bg-thrst-accent/90"
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
