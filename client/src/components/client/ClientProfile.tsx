import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ClientData } from "@/lib/types";
import { ArrowLeft, Mail, Target, Weight, Ruler, Calendar, MessageSquare, Edit, Save, X, Plus, Loader2 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { clientFormSchema } from "@/pages/client-management";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

type ClientProfileProps = {
  client: ClientData;
  onBack: () => void;
  onEdit: (data: z.infer<typeof clientFormSchema>) => Promise<void>;
  onMessage: () => void;
  isEditing: boolean;
  onCancelEdit: () => void;
  isSaving: boolean;
};

export function ClientProfile({ client, onBack, onEdit, onMessage, isEditing, onCancelEdit, isSaving }: ClientProfileProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof clientFormSchema>>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      firstName: client.user?.firstName || "",
      lastName: client.user?.lastName || "",
      email: client.user?.email || "",
      goals: typeof client.goals === 'object' ? client.goals?.description : client.goals || "",
      currentWeight: client.currentWeight || undefined,
      targetWeight: client.targetWeight || undefined,
      height: client.height || undefined,
    },
  });

  const onSubmit = async (data: z.infer<typeof clientFormSchema>) => {
    await onEdit(data);
  };
  const progress = client.currentWeight && client.targetWeight 
    ? Math.min(100, Math.max(0, ((client.currentWeight - client.targetWeight) / (client.currentWeight - client.targetWeight)) * 100))
    : 0;

  // Workout creation form (free-text exercises: name + sets/details string)
  const workoutFormSchema = z.object({
    name: z.string().min(1, "Workout name is required"),
    description: z.string().optional(),
    scheduledDate: z.string().min(1, "Scheduled date is required"),
    exercises: z.array(z.object({
      name: z.string().min(1, "Exercise name is required"),
      // Coaches can write anything like "10 reps, 2 sets" or other details
      sets: z.string().min(1, "Details are required"),
      // Optional explanation/comment per exercise
      comment: z.string().optional(),
    })).min(1, "At least one exercise is required"),
  });

  type WorkoutFormData = z.infer<typeof workoutFormSchema>;

  const workoutForm = useForm<WorkoutFormData>({
    resolver: zodResolver(workoutFormSchema),
    defaultValues: {
      name: "",
      description: "",
      scheduledDate: new Date().toISOString().slice(0, 16),
      exercises: [{ name: "", sets: "", comment: "" }],
    },
  });

  const { fields: exerciseFields, append: appendExercise, remove: removeExercise } = useFieldArray({
    control: workoutForm.control,
    name: "exercises",
  });

  const [isWorkoutDialogOpen, setIsWorkoutDialogOpen] = useState(false);

  const onCreateWorkout = async (data: WorkoutFormData) => {
    try {
      const payload = {
        ...data,
        clientId: client.id,
        exercises: (data.exercises || [])
          .filter(ex => (ex.name || '').trim() !== '')
          .map(ex => ({ name: ex.name, sets: String(ex.sets), ...(ex.comment ? { comment: ex.comment } : {}) })),
      };

      const res = await fetch('/api/coach/workouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create workout');
      }

      workoutForm.reset();
      setIsWorkoutDialogOpen(false);
      toast({ title: 'Workout created', description: 'The workout was created successfully.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to create workout', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to clients
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={onMessage}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Message
          </Button>
          <Dialog open={isWorkoutDialogOpen} onOpenChange={setIsWorkoutDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="bg-thrst-green hover:bg-thrst-green/90">
                <Plus className="h-4 w-4 mr-2" />
                Create Workout
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Workout for {client.user?.firstName} {client.user?.lastName}</DialogTitle>
                <DialogDescription>Define the workout details and exercises.</DialogDescription>
              </DialogHeader>
              <Form {...workoutForm}>
                <form onSubmit={workoutForm.handleSubmit(onCreateWorkout)} className="space-y-4">
                  <FormField
                    control={workoutForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workout Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Upper Body Strength" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={workoutForm.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scheduled Date & Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} min={new Date().toISOString().slice(0, 16)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={workoutForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Notes or instructions..." className="min-h-[90px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-base">Exercises</FormLabel>
                      <Button type="button" size="sm" variant="outline" onClick={() => appendExercise({ name: "", sets: "", comment: "" })}>
                        <Plus className="h-3 w-3 mr-1" /> Add Exercise
                      </Button>
                    </div>

                    {exerciseFields.map((f, index) => (
                      <div key={f.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 border rounded-md">
                        <FormField
                          control={workoutForm.control}
                          name={`exercises.${index}.name`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Squat" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={workoutForm.control}
                          name={`exercises.${index}.sets`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sets</FormLabel>
                              <FormControl>
                                <Input type="text" placeholder="e.g., 10 reps, 2 sets; or any details" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={workoutForm.control}
                          name={`exercises.${index}.comment`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-6">
                              <FormLabel>Comment</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Notes/instructions for this exercise (optional)" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={workoutForm.control}
                          name={`exercises.${index}.repsMin`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reps Min</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} value={field.value as any} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={workoutForm.control}
                          name={`exercises.${index}.repsMax`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reps Max</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} value={field.value as any} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={workoutForm.control}
                          name={`exercises.${index}.weightMin`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Weight Min (kg)</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} step={0.5} value={field.value as any} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={workoutForm.control}
                          name={`exercises.${index}.weightMax`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Weight Max (kg)</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} step={0.5} value={field.value as any} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={workoutForm.control}
                          name={`exercises.${index}.comment`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-6">
                              <FormLabel>Comment</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Notes/instructions for this exercise (optional)" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="md:col-span-4 flex justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeExercise(index)} disabled={exerciseFields.length <= 1}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsWorkoutDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-thrst-green hover:bg-thrst-green/90">
                      <Loader2 className="h-4 w-4 mr-2 hidden" />
                      Create Workout
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onCancelEdit}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={form.handleSubmit(onSubmit)}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {}}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between">
            <div>
              {isEditing ? (
                <Form {...form}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </Form>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-2xl">
                      {client.user?.firstName} {client.user?.lastName}
                    </CardTitle>
                    <Badge variant={client.isActive ? 'default' : 'secondary'}>
                      {client.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center text-muted-foreground mt-1">
                    <Mail className="h-4 w-4 mr-2" />
                    {client.user?.email}
                  </div>
                </>
              )}
            </div>
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {client.firstName?.charAt(0)}{client.lastName?.charAt(0)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium text-muted-foreground">Current Weight</div>
                {isEditing ? (
                  <FormField
                    control={form.control}
                    name="currentWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            className="text-2xl font-bold w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="text-2xl font-bold">
                    {client.currentWeight ? `${client.currentWeight} kg` : '--'}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground flex items-center">
                  <Weight className="h-3 w-3 mr-1" />
                  {isEditing ? (
                    <FormField
                      control={form.control}
                      name="targetWeight"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className="text-xs">Target Weight (kg)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              className="h-6 text-xs"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <span>{client.targetWeight ? `Target: ${client.targetWeight} kg` : 'No target set'}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium text-muted-foreground">Height</div>
                {isEditing ? (
                  <FormField
                    control={form.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex items-center">
                            <Input 
                              type="number" 
                              {...field} 
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              className="text-2xl font-bold w-32"
                            />
                            <span className="ml-2 text-muted-foreground">cm</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="text-2xl font-bold">
                    {client.height ? `${client.height} cm` : '--'}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground flex items-center">
                  <Ruler className="h-3 w-3 mr-1" />
                  Last updated: {new Date(client.updatedAt || client.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium text-muted-foreground">Member Since</div>
                <div className="text-2xl font-bold">
                  {new Date(client.createdAt).toLocaleDateString('default', { month: 'short', year: 'numeric' })}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {Math.floor((new Date().getTime() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Goals</h3>
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <FormField
                  control={form.control}
                  name="goals"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Enter client's fitness goals..."
                          className="min-h-[100px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <p className="text-muted-foreground">
                  {client.goals || 'No goals set yet'}
                </p>
              )}
              
              {client.currentWeight && client.targetWeight && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
