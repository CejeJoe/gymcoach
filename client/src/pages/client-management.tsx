import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { z } from "zod";
import { GlassCard } from "@/components/ui/glass-card";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ClientData, AuthUser } from "@/lib/types";
import { useForm, FormProvider } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, Edit, Trash2, Users, Target, Weight, Mail, ArrowLeft, MessageSquare, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClientForm } from "@/components/ClientForm";
import type { ClientFormValues } from "@/components/ClientForm";
import { ClientList } from "@/components/client/ClientList";
import { ClientProfile } from "@/components/client/ClientProfile";
import { ClientImport } from "@/components/client/ClientImport";
import { BroadcastComposer } from "@/components/broadcast/BroadcastComposer";

interface ClientManagementProps {
  user: AuthUser;
}

type NumberInputValue = number | '';

export const clientFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  goals: z.string().optional(),
  generateTempPassword: z.boolean().default(true),
  currentWeight: z.union([
    z.number().positive("Must be a positive number"),
    z.string().transform((val, ctx) => {
      if (val === '') return null;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a valid number",
        });
        return z.NEVER;
      }
      return num > 0 ? num : null;
    })
  ]).nullable().default(null),
  targetWeight: z.union([
    z.number().positive("Must be a positive number"),
    z.string().transform((val, ctx) => {
      if (val === '') return null;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a valid number",
        });
        return z.NEVER;
      }
      return num > 0 ? num : null;
    })
  ]).nullable().default(null),
  height: z.union([
    z.number().positive("Must be a positive number"),
    z.string().transform((val, ctx) => {
      if (val === '') return null;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a valid number",
        });
        return z.NEVER;
      }
      return num > 0 ? num : null;
    })
  ]).nullable().default(null),
});

type ClientFormData = {
  firstName: string;
  lastName: string;
  email: string;
  goals?: string;
  currentWeight?: number | null;
  targetWeight?: number | null;
  height?: number | null;
};

export default function ClientManagement({ user }: ClientManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newClientCreds, setNewClientCreds] = useState<{ email: string; tempPassword: string } | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleClientSelect = (client: ClientData) => {
    setSelectedClient(client);
    setIsEditing(false);
  };

  const handleBackToList = () => {
    setSelectedClient(null);
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
  };


  const { data: response, isLoading, error, isError, refetch: refetchClients } = useQuery({
    queryKey: ['/api/coach/clients'],
    queryFn: async () => {
      try {
        // Use shared apiRequest to centralize 401/403 handling (clears auth and redirects to /login)
        const res = await apiRequest('GET', '/api/coach/clients');
        const data = await res.json();
        
        // Return the data directly - React Query will handle the response properly
        return data;
      } catch (error) {
        console.error('Error fetching clients:', error);
        throw error;
      }
    },
  });

  // Extract clients from response - handle both array and object formats
  const clients = Array.isArray(response) ? response : (response?.clients || []);
  const totalClients = Array.isArray(response) ? response.length : (response?.total ?? clients.length);

  const addClientMutation = useMutation({
    mutationFn: async (formData: ClientFormValues) => {
      console.log('Starting client creation with data:', formData);
      try {
        // Single server call: server will create user if necessary
        const payload = {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          goals: formData.goals ? { description: formData.goals } : null,
          generateTempPassword: formData.generateTempPassword ?? true,
          currentWeight: formData.currentWeight !== null ? Number(formData.currentWeight) : null,
          targetWeight: formData.targetWeight !== null ? Number(formData.targetWeight) : null,
          height: formData.height !== null ? Number(formData.height) : null,
          isActive: true,
        };

        const res = await fetch('/api/coach/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          // Try JSON, else text
          const err = await res.json().catch(async () => ({ message: await res.text().catch(() => 'Failed to create client') }));
          throw new Error(err.message || 'Failed to create client');
        }

        return await res.json();
      } catch (error) {
        console.error('Error in client creation:', error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      try {
        // 1) Optimistically merge new client into cache to avoid flicker
        queryClient.setQueryData(['/api/coach/clients'], (old: any) => {
          if (!old) return { clients: [data?.client].filter(Boolean) };
          const existing = Array.isArray(old) ? old : (old.clients || []);
          const merged = data?.client ? [...existing, data.client] : existing;
          return Array.isArray(old) ? merged : { ...(old || {}), clients: merged };
        });

        // Also keep stats fresh in the background
        queryClient.invalidateQueries({ queryKey: ['/api/coach/stats'] });

        // 2) Show Share Client Login dialog if tempPassword present
        const email = pendingEmail || data?.client?.user?.email || data?.client?.email || '';
        if (data?.tempPassword) {
          setNewClientCreds({ email, tempPassword: data.tempPassword });
          // Optional helper toast with quick copy
          try {
            await navigator.clipboard.writeText(data.tempPassword);
            toast({ title: 'Temporary password copied', description: `For ${email}` });
          } catch {
            toast({ title: 'Client created', description: 'Temporary password is shown in the dialog' });
          }
        } else {
          toast({ title: 'Success', description: 'Client added successfully' });
        }
      } finally {
        // 3) Close the Add Client dialog after surfacing credentials
        setIsAddDialogOpen(false);
        // Trigger a background refetch to reconcile with server
        refetchClients();
      }

      console.log('Client added successfully:', data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add client",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ clientId, data }: { clientId: string; data: Partial<ClientFormValues> }) => {
      const response = await fetch(`/api/coach/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update client');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/clients'] });
      toast({
        title: 'Success',
        description: 'Client updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update client',
        variant: 'destructive',
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

  // Reset a client's password and show a new temporary password
  const handleResetPassword = async (clientId: string) => {
    if (!clientId) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/coach/clients/${clientId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(async () => ({ message: await res.text().catch(() => 'Failed to reset password') }));
        throw new Error(err.message || 'Failed to reset password');
      }
      const data = await res.json();
      const email = selectedClient?.user?.email || '';
      setNewClientCreds({ email, tempPassword: data.tempPassword });
      try {
        await navigator.clipboard.writeText(String(data.tempPassword || ''));
        toast({ title: 'Temporary password copied', description: `For ${email}` });
      } catch {
        toast({ title: 'Password reset', description: 'Temporary password is shown in the dialog' });
      }
    } catch (e: any) {
      console.error('Reset password error:', e);
      toast({ title: 'Error', description: e?.message || 'Failed to reset password', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const form = useForm<z.infer<typeof clientFormSchema>>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      goals: '',
      generateTempPassword: true,
      currentWeight: null,
      targetWeight: null,
      height: null,
    },
    mode: 'onChange',
  });

  const editForm = useForm<z.infer<typeof clientFormSchema>>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      goals: '',
      currentWeight: null,
      targetWeight: null,
      height: null,
    },
    mode: 'onChange',
  });

  // Pre-fill edit form when an editing client is selected
  useEffect(() => {
    if (!editingClient) return;
    const g = (editingClient as any).goals;
    const goalsText = typeof g === 'string' ? g : (g && typeof g === 'object' && !Array.isArray(g) ? (g.description ?? '') : '');
    editForm.reset({
      firstName: editingClient.user?.firstName || '',
      lastName: editingClient.user?.lastName || '',
      email: editingClient.user?.email || '',
      goals: goalsText,
      currentWeight: editingClient.currentWeight ?? null,
      targetWeight: editingClient.targetWeight ?? null,
      height: editingClient.height ?? null,
    });
  }, [editingClient, editForm]);

  const handleEditClientSubmit = async (formData: z.infer<typeof clientFormSchema>) => {
    if (!editingClient) return;
    
    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        goals: formData.goals ? { description: formData.goals } : null,
        currentWeight: formData.currentWeight,
        targetWeight: formData.targetWeight,
        height: formData.height,
      };
      
      await updateClientMutation.mutateAsync({
        clientId: editingClient.id,
        data: updateData,
      });
      
      setEditingClient(null);
    } catch (error) {
      console.error("Error updating client:", error);
      // Error is handled by the mutation's onError
    }
  };

  const handleEditClient = async (formData: z.infer<typeof clientFormSchema>) => {
    if (!selectedClient) return;
    
    setIsSaving(true);
    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        goals: formData.goals ? { description: formData.goals } : null,
        currentWeight: formData.currentWeight,
        targetWeight: formData.targetWeight,
        height: formData.height,
      };

      const response = await fetch(`/api/coach/clients/${selectedClient.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to update client');
      }

      // Update the selected client with new data
      const updatedClient = await response.json();
      setSelectedClient(updatedClient);
      
      // Update the clients list
      queryClient.setQueryData(['/api/coach/clients'], (old: any) => ({
        clients: old.clients.map((c: ClientData) => 
          c.id === updatedClient.id ? updatedClient : c
        )
      }));

      toast({
        title: 'Success',
        description: 'Client updated successfully',
      });
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: 'Error',
        description: 'Failed to update client. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (clientId: string) => {
    if (confirm('Are you sure you want to remove this client?')) {
      deleteClientMutation.mutate(clientId);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-thrst-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Error</h1>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Coach Profile Header */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-semibold text-sm">CG</span>
            </div>
            <span className="text-foreground font-medium">Coach Grace</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <div className="w-4 h-4 border border-foreground rounded"></div>
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <div className="w-4 h-4 border border-foreground rounded-full"></div>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 space-y-6">
        {/* Today's Session */}
        <div>
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">Wed</span>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">Time to workout</span>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">15</span>
                  <span className="text-muted-foreground text-sm">min</span>
                </div>
              </div>
            </div>
            <h3 className="text-foreground font-semibold text-lg mb-2">Today's Session</h3>
            <div className="bg-primary/10 rounded-xl p-4 mb-4">
              <h4 className="text-foreground font-semibold mb-1">Strength</h4>
              <p className="text-muted-foreground text-sm mb-3">Random center</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">35 min</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">530 kcal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground font-semibold text-lg">Categories</h3>
            <Button variant="ghost" className="text-muted-foreground text-sm">See All</Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">Yoga</h4>
              <p className="text-muted-foreground text-sm">100 Exercises</p>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-3">
                <Target className="w-6 h-6 text-red-500" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">Boxing</h4>
              <p className="text-muted-foreground text-sm">50 Exercises</p>
            </div>
          </div>
        </div>

        {/* Client Management Section */}
        <div className="bg-primary rounded-3xl p-6 relative overflow-hidden mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-primary-foreground font-bold text-xl mb-1">Client Management</h2>
              <div className="flex items-center gap-2 text-primary-foreground/80 text-sm">
                <span className="w-2 h-2 bg-primary-foreground rounded-full"></span>
                <span>{totalClients} Clients</span>
              </div>
              <div className="flex items-center gap-2 text-primary-foreground/80 text-sm mt-1">
                <span className="w-2 h-2 bg-primary-foreground rounded-full"></span>
                <span>30min</span>
              </div>
            </div>
            <div className="w-16 h-16 bg-primary-foreground/20 rounded-2xl flex items-center justify-center">
              <Users className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <Button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-full px-6">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <span>Add Client</span>
              </DialogTrigger>
              <DialogContent className="glass-morphism border-white/10">
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                  <DialogDescription>
                    Enter the client's information to add them to your dashboard.
                  </DialogDescription>
                </DialogHeader>
                <FormProvider {...form}>
                  <ClientForm 
                    control={form.control}
                    onSubmit={(data) => { setPendingEmail(data.email); addClientMutation.mutate(data); }}
                    onCancel={() => setIsAddDialogOpen(false)}
                    isSubmitting={addClientMutation.isPending}
                  />
                </FormProvider>
              </DialogContent>
            </Dialog>
          </Button>
        </div>

        {/* Clients List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-thrst-accent"></div>
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-red-500">
              Failed to load clients. Please try again later.
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 w-full">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
              <p className="text-muted-foreground mb-4">Start building your client base</p>
              <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-thrst-accent hover:bg-thrst-accent/90"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Your First Client
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <ClientList 
                clients={clients} 
                onSelectClient={handleClientSelect} 
                onAddNew={() => setIsAddDialogOpen(true)}
                selectedClientId={selectedClient?.id}
              />

              {selectedClient && (
                <GlassCard className="p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="w-12 h-12 thrst-gradient rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold">
                          {selectedClient.user?.firstName?.charAt(0) || 'C'}
                          {selectedClient.user?.lastName?.charAt(0) || ''}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {selectedClient.user?.firstName || 'Unknown'} {selectedClient.user?.lastName || ''}
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-muted-foreground gap-1 sm:gap-0">
                          <span className="flex items-center truncate">
                            <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">{selectedClient.user?.email}</span>
                          </span>
                          {selectedClient.currentWeight && (
                            <span className="flex items-center">
                              <Weight className="h-3 w-3 mr-1" />
                              {selectedClient.currentWeight}kg
                            </span>
                          )}
                          {selectedClient.targetWeight && (
                            <span className="flex items-center">
                              <Target className="h-3 w-3 mr-1" />
                              Target: {selectedClient.targetWeight}kg
                            </span>
                          )}
                        </div>
                        {selectedClient.goals && typeof selectedClient.goals === 'object' && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {selectedClient.goals.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <Badge className={selectedClient.isActive ? "bg-green-500" : "bg-gray-500"}>
                        {selectedClient.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(selectedClient.id)}
                        title="Reset Client Password"
                        disabled={isSaving}
                        className="flex items-center gap-1"
                      >
                        <Key className="h-4 w-4" />
                        <span className="hidden sm:inline">Reset Password</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          // Navigate to messages page for this client
                          window.location.href = `/messages?clientId=${selectedClient.id}&clientName=${encodeURIComponent(selectedClient.user?.firstName + ' ' + selectedClient.user?.lastName)}`;
                        }}
                        title="Send Message"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setEditingClient(selectedClient);
                          setIsEditing(true);
                        }}
                        title="Edit Client"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(selectedClient.id)}
                        className="text-thrst-accent hover:bg-thrst-accent/20"
                        title="Delete Client"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Warm-up Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground font-semibold text-lg">Dynamic Warm-up</h3>
            <Button variant="ghost" className="text-muted-foreground text-sm">See All</Button>
          </div>
          <div className="space-y-3">
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-xl flex-shrink-0"></div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">Biceps curl</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>15 minutes</span>
                    <span>Beginner</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-xl flex-shrink-0"></div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">Pull Up</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>15 minutes</span>
                    <span>Beginner</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-8">
            <Button className="bg-primary text-primary-foreground rounded-full px-6 py-2 font-medium">
              Home
            </Button>
            <Button variant="ghost" size="icon" className="w-10 h-10">
              <div className="w-5 h-5 border-2 border-foreground"></div>
            </Button>
            <Button variant="ghost" size="icon" className="w-10 h-10">
              <div className="w-5 h-5 border-2 border-foreground"></div>
            </Button>
            <Button variant="ghost" size="icon" className="w-10 h-10">
              <div className="w-5 h-5 border-2 border-foreground rounded-full"></div>
            </Button>
          </div>
        </div>
      </div>


      {/* New Client Credentials Dialog */}
      <Dialog open={!!newClientCreds} onOpenChange={(open) => !open && setNewClientCreds(null)}>
        <DialogContent className="glass-morphism border-white/10">
          <DialogHeader>
            <DialogTitle>Share Client Login</DialogTitle>
            <DialogDescription>
              A new user account was created. Share these temporary credentials with your client so they can log in and view workouts.
            </DialogDescription>
          </DialogHeader>
          {newClientCreds && (
            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Email</div>
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 rounded bg-muted">{newClientCreds.email}</code>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(newClientCreds.email)}>Copy</Button>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Temporary Password</div>
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 rounded bg-muted">{newClientCreds.tempPassword}</code>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(newClientCreds.tempPassword)}>Copy</Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Ask the client to log in and change their password.</div>
              <div className="flex justify-end">
                <Button className="bg-thrst-accent hover:bg-thrst-accent/90" onClick={() => setNewClientCreds(null)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog 
        open={!!editingClient} 
        onOpenChange={(open) => {
          if (!open) setEditingClient(null);
        }}
      >
        <DialogContent className="glass-morphism border-white/10">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update the client's information as needed.
            </DialogDescription>
          </DialogHeader>
          {editingClient && (
            <FormProvider {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditClientSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="edit-first-name">First Name</FormLabel>
                        <FormControl>
                          <Input {...field} id="edit-first-name" name="firstName" autoComplete="given-name" data-testid="edit-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="edit-last-name">Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} id="edit-last-name" name="lastName" autoComplete="family-name" data-testid="edit-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="edit-email">Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} id="edit-email" name="email" autoComplete="email" data-testid="edit-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="currentWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="edit-current-weight">Current Weight (kg)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            id="edit-current-weight"
                            name="currentWeight"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : '')}
                            data-testid="edit-current-weight"
                          />
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
                        <FormLabel htmlFor="edit-target-weight">Target Weight (kg)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            id="edit-target-weight"
                            name="targetWeight"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : '')}
                            data-testid="edit-target-weight"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="goals"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel htmlFor="edit-goals">Goals</FormLabel>
                        <FormControl>
                          <Textarea
                            id="edit-goals"
                            name="goals"
                            {...field}
                            value={field.value || ''}
                            className="min-h-[100px]"
                            data-testid="edit-goals"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingClient(null)}
                    disabled={updateClientMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-thrst-accent hover:bg-thrst-accent/90"
                    disabled={updateClientMutation.isPending}
                  >
                    {updateClientMutation.isPending ? 'Saving...' : 'Update Client'}
                  </Button>
                </div>
              </form>
            </FormProvider>
          )}
        </DialogContent>
      </Dialog>

      {/* Broadcast Composer */}
      <BroadcastComposer 
        open={isBroadcastOpen} 
        onOpenChange={setIsBroadcastOpen} 
      />
    </div>
  );
}