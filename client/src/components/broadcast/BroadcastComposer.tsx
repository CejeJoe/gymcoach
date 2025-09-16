import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';

interface BroadcastComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BroadcastComposer({ open, onOpenChange }: BroadcastComposerProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | 'clients'>('all');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [workoutId, setWorkoutId] = useState('none');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch clients for selection
  const { data: clientsResponse } = useQuery({
    queryKey: ['/api/coach/clients'],
    queryFn: async () => {
      const response = await fetch('/api/coach/clients', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
    enabled: open
  });

  const sendNowMutation = useMutation({
    mutationFn: async (data: any) => {
      // 1) Create the group message
      const createRes = await fetch('/api/coach/group-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create broadcast');
      }
      const created = await createRes.json();
      if (!created?.id) {
        throw new Error('Broadcast created, but missing id');
      }

      // 2) Trigger immediate send
      const sendRes = await fetch(`/api/coach/group-messages/${created.id}/send-now`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to send broadcast now');
      }
      return created;
    },
    onSuccess: () => {
      toast({
        title: 'Broadcast sent',
        description: `Delivery triggered to ${recipientsCount} recipient(s). Open any recipient thread to view it.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/coach/group-messages'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send broadcast now',
        variant: 'destructive',
      });
    },
  });

  // Fetch workouts for attachment
  const { data: workoutsResponse } = useQuery({
    queryKey: ['/api/coach/workouts'],
    queryFn: async () => {
      const response = await fetch('/api/coach/workouts', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch workouts');
      return response.json();
    },
    enabled: open
  });

  const clients = Array.isArray(clientsResponse) ? clientsResponse : (clientsResponse?.clients || []);
  const workouts = Array.isArray(workoutsResponse) ? workoutsResponse : (workoutsResponse?.workouts || []);

  // Treat missing isActive as active, align with dashboard behavior
  const activeClients = (clients || []).filter((c: any) => c.isActive !== false);
  const recipientsCount = audienceType === 'all'
    ? activeClients.length
    : selectedClients.length;

  const createBroadcastMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/coach/group-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create broadcast');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Broadcast scheduled successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/coach/group-messages'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create broadcast',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setTitle('');
    setBody('');
    setScheduledAt('');
    setAudienceType('all');
    setSelectedClients([]);
    setRequireConfirmation(false);
    setWorkoutId('none');
  };

  const handleSendNow = async () => {
    if (!body.trim()) {
      toast({ title: 'Error', description: 'Message is required', variant: 'destructive' });
      return;
    }
    const audience = audienceType === 'all'
      ? { type: 'all' }
      : { type: 'clients', ids: selectedClients };
    const when = scheduledAt ? new Date(scheduledAt) : new Date();
    sendNowMutation.mutate({
      title: title.trim() || null,
      body: body.trim(),
      scheduledAt: when.toISOString(),
      audience,
      requireConfirmation,
      workoutId: workoutId === 'none' ? null : workoutId || null,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!body.trim() || !scheduledAt) {
      toast({
        title: 'Error',
        description: 'Message and schedule time are required',
        variant: 'destructive',
      });
      return;
    }

    const audience = audienceType === 'all' 
      ? { type: 'all' }
      : { type: 'clients', ids: selectedClients };

    createBroadcastMutation.mutate({
      title: title.trim() || null,
      body: body.trim(),
      scheduledAt: new Date(scheduledAt).toISOString(),
      audience,
      requireConfirmation,
      workoutId: workoutId === 'none' ? null : workoutId || null,
    });
  };

  const handleClientToggle = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Broadcast Message</DialogTitle>
          <DialogDescription>
            Schedule a message to be sent to all or selected clients at a specific time.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title (Optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Broadcast title..."
            />
          </div>

          <div>
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter your message..."
              className="min-h-[100px]"
              required
            />
          </div>

          <div>
            <Label htmlFor="scheduledAt">Schedule Time *</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Audience</Label>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="all-clients"
                  name="audience"
                  checked={audienceType === 'all'}
                  onChange={() => setAudienceType('all')}
                />
                <Label htmlFor="all-clients">All Clients</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="specific-clients"
                  name="audience"
                  checked={audienceType === 'clients'}
                  onChange={() => setAudienceType('clients')}
                />
                <Label htmlFor="specific-clients">Specific Clients</Label>
              </div>
            </div>
          </div>

          {audienceType === 'clients' && (
            <div>
              <Label>Select Clients</Label>
              <div className="max-h-40 overflow-y-auto border rounded p-2 mt-2">
                {clients.map((client: any) => (
                  <div key={client.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`client-${client.id}`}
                      checked={selectedClients.includes(client.id)}
                      onCheckedChange={() => handleClientToggle(client.id)}
                    />
                    <Label htmlFor={`client-${client.id}`} className="text-sm">
                      {client.user?.firstName} {client.user?.lastName}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="workout">Attach Workout (Optional)</Label>
            <Select value={workoutId} onValueChange={setWorkoutId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a workout to attach..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No workout</SelectItem>
                {workouts.map((workout: any) => (
                  <SelectItem key={workout.id} value={workout.id}>
                    {workout.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="require-confirmation"
              checked={requireConfirmation}
              onCheckedChange={setRequireConfirmation}
            />
            <Label htmlFor="require-confirmation">Require confirmation from clients</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createBroadcastMutation.isPending || sendNowMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendNow}
              disabled={createBroadcastMutation.isPending || sendNowMutation.isPending}
            >
              {sendNowMutation.isPending ? 'Sending…' : 'Send Now'}
            </Button>
            <Button
              type="submit"
              disabled={createBroadcastMutation.isPending || sendNowMutation.isPending}
            >
              {createBroadcastMutation.isPending ? 'Scheduling...' : 'Schedule Broadcast'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
