import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GlassCard } from "@/components/ui/glass-card";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ClientData, AuthUser } from "@/lib/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  UserPlus, 
  Edit, 
  Trash2, 
  Users, 
  Target,
  Weight,
  Calendar,
  Phone,
  Mail,
  ChevronRight
} from "lucide-react";

interface ClientManagementProps {
  user: AuthUser;
}

const clientFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  goals: z.string().optional(),
  currentWeight: z.string().optional(),
  targetWeight: z.string().optional(),
  height: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

export default function ClientManagement({ user }: ClientManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery<ClientData[]>({
    queryKey: ['/api/coach/clients'],
    queryFn: async () => {
      const response = await fetch('/api/coach/clients', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
  });

  const addClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      // First create user account
      const userResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: 'temp123', // Temporary password
          role: 'client',
          firstName: data.firstName,
          lastName: data.lastName,
        }),
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to create user account');
      }
      
      const userData = await userResponse.json();
      
      // Then create client profile
      const clientResponse = await fetch('/api/coach/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          userId: userData.user.id,
          coachId: user.id,
          goals: data.goals ? { description: data.goals } : undefined,
          currentWeight: data.currentWeight || null,
          targetWeight: data.targetWeight || null,
          height: data.height || null,
          isActive: true,
        }),
      });
      
      if (!clientResponse.ok) {
        throw new Error('Failed to create client profile');
      }
      
      return clientResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coach/stats'] });
      setIsAddDialogOpen(false);
      addForm.reset();
      toast({
        title: "Success",
        description: "Client added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add client",
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ clientId, data }: { clientId: string; data: Partial<ClientFormData> }) => {
      const response = await fetch(`/api/coach/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          goals: data.goals ? { description: data.goals } : undefined,
          currentWeight: data.currentWeight || null,
          targetWeight: data.targetWeight || null,
          height: data.height || null,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update client');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/clients'] });
      setEditingClient(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update client",
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/coach/clients/${clientId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete client');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coach/stats'] });
      toast({
        title: "Success",
        description: "Client removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove client",
        variant: "destructive",
      });
    },
  });

  const addForm = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      goals: "",
      currentWeight: "",
      targetWeight: "",
      height: "",
    },
  });

  const editForm = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema.partial()),
    defaultValues: {
      goals: "",
      currentWeight: "",
      targetWeight: "",
      height: "",
    },
  });

  const onAddSubmit = (data: ClientFormData) => {
    addClientMutation.mutate(data);
  };

  const onEditSubmit = (data: ClientFormData) => {
    if (editingClient) {
      updateClientMutation.mutate({
        clientId: editingClient.id,
        data,
      });
    }
  };

  const handleEdit = (client: ClientData) => {
    setEditingClient(client);
    editForm.reset({
      goals: typeof client.goals === 'object' ? client.goals?.description || '' : '',
      currentWeight: client.currentWeight?.toString() || '',
      targetWeight: client.targetWeight?.toString() || '',
      height: client.height?.toString() || '',
    });
  };

  const handleDelete = (clientId: string) => {
    if (confirm('Are you sure you want to remove this client?')) {
      deleteClientMutation.mutate(clientId);
    }
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
          <h1 className="text-2xl font-bold">Client Management</h1>
          <p className="text-muted-foreground">Manage your client profiles and information</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-thrst-green hover:bg-thrst-green/90" data-testid="button-add-client">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-morphism border-white/10">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={addForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={addForm.control}
                    name="currentWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (kg)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} data-testid="input-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="targetWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target (kg)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} data-testid="input-target-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height (cm)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-height" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={addForm.control}
                  name="goals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goals</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Fitness goals and notes..." data-testid="input-goals" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-thrst-green hover:bg-thrst-green/90"
                    disabled={addClientMutation.isPending}
                    data-testid="button-save-client"
                  >
                    {addClientMutation.isPending ? "Adding..." : "Add Client"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Clients Grid */}
      <div className="grid gap-4">
        {clients?.map((client) => (
          <GlassCard key={client.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 thrst-gradient rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">
                    {client.user?.firstName?.charAt(0) || 'C'}
                    {client.user?.lastName?.charAt(0) || ''}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" data-testid={`text-client-name-${client.id}`}>
                    {client.user?.firstName || 'Unknown'} {client.user?.lastName || ''}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center">
                      <Mail className="h-3 w-3 mr-1" />
                      {client.user?.email}
                    </span>
                    {client.currentWeight && (
                      <span className="flex items-center">
                        <Weight className="h-3 w-3 mr-1" />
                        {client.currentWeight}kg
                      </span>
                    )}
                    {client.targetWeight && (
                      <span className="flex items-center">
                        <Target className="h-3 w-3 mr-1" />
                        Target: {client.targetWeight}kg
                      </span>
                    )}
                  </div>
                  {client.goals && typeof client.goals === 'object' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {client.goals.description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge variant={client.isActive ? "secondary" : "outline"}>
                  {client.isActive ? "Active" : "Inactive"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(client)}
                  data-testid={`button-edit-${client.id}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(client.id)}
                  className="text-thrst-accent hover:bg-thrst-accent/20"
                  data-testid={`button-delete-${client.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </GlassCard>
        )) || (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
            <p className="text-muted-foreground mb-4">Start building your client base</p>
            <Button 
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-thrst-green hover:bg-thrst-green/90"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Your First Client
            </Button>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent className="glass-morphism border-white/10">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={editForm.control}
                    name="currentWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (kg)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="targetWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target (kg)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height (cm)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="goals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goals</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Fitness goals and notes..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setEditingClient(null)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-thrst-green hover:bg-thrst-green/90"
                    disabled={updateClientMutation.isPending}
                  >
                    {updateClientMutation.isPending ? "Updating..." : "Update Client"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}