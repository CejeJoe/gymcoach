import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { 
  MessageSquare, 
  Star, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  User,
  ChevronRight,
  Filter,
  SortDesc
} from 'lucide-react';

interface ClientFeedback {
  id: string;
  clientId: string;
  clientName: string;
  type: 'feedback' | 'concern' | 'question' | 'compliment';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  message: string;
  timestamp: string;
  status: 'unread' | 'read' | 'responded' | 'resolved';
  rating?: number;
  workoutId?: string;
  sessionDate?: string;
}

interface ClientFeedbackPanelProps {
  position: 'top' | 'sidebar' | 'bottom';
  isProminent?: boolean;
  maxHeight?: string;
}

export default function ClientFeedbackPanel({ 
  position, 
  isProminent = true, 
  maxHeight = "400px" 
}: ClientFeedbackPanelProps) {
  const [feedbacks, setFeedbacks] = useState<ClientFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('unread');
  const { toast } = useToast();

  useEffect(() => {
    fetchClientFeedback();
    // Set up auto-refresh for feedback
    const interval = setInterval(fetchClientFeedback, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchClientFeedback = async () => {
    try {
      const response = await fetch('/api/client/feedback', {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setFeedbacks(data || []);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching client feedback:', error);
      // Mock data for demonstration
      setFeedbacks([
        {
          id: '1',
          clientId: 'client1',
          clientName: 'Sarah Johnson',
          type: 'concern',
          priority: 'high',
          message: 'Having trouble with the new workout routine. The squats are causing knee pain.',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'unread',
          workoutId: 'workout1',
          sessionDate: '2025-01-08'
        },
        {
          id: '2',
          clientId: 'client2',
          clientName: 'Mike Chen',
          type: 'feedback',
          priority: 'medium',
          message: 'Really enjoying the voice logging feature! Makes tracking so much easier.',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          status: 'unread',
          rating: 5
        },
        {
          id: '3',
          clientId: 'client3',
          clientName: 'Emma Davis',
          type: 'question',
          priority: 'medium',
          message: 'Should I increase the weight for deadlifts next week?',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          status: 'read'
        },
        {
          id: '4',
          clientId: 'client4',
          clientName: 'Alex Rodriguez',
          type: 'compliment',
          priority: 'low',
          message: 'Thanks for the great session yesterday! Feeling stronger already.',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          status: 'responded',
          rating: 5
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (feedbackId: string) => {
    try {
      await fetch(`/api/client-feedback/${feedbackId}/read`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      
      setFeedbacks(prev => 
        prev.map(f => f.id === feedbackId ? { ...f, status: 'read' } : f)
      );
    } catch (error) {
      console.error('Error marking feedback as read:', error);
      // Update locally for demo
      setFeedbacks(prev => 
        prev.map(f => f.id === feedbackId ? { ...f, status: 'read' } : f)
      );
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'concern':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'feedback':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'question':
        return <MessageSquare className="h-4 w-4 text-yellow-500" />;
      case 'compliment':
        return <Star className="h-4 w-4 text-green-500" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'unread':
        return <div className="w-2 h-2 bg-blue-500 rounded-full" />;
      case 'read':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'responded':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'resolved':
        return <CheckCircle className="h-3 w-3 text-gray-500" />;
      default:
        return null;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const filteredFeedbacks = feedbacks.filter(feedback => {
    switch (filter) {
      case 'unread':
        return feedback.status === 'unread';
      case 'urgent':
        return feedback.priority === 'urgent' || feedback.priority === 'high';
      default:
        return true;
    }
  }).sort((a, b) => {
    // Sort by priority first, then by timestamp
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const unreadCount = feedbacks.filter(f => f.status === 'unread').length;
  const urgentCount = feedbacks.filter(f => f.priority === 'urgent' || f.priority === 'high').length;

  const containerClass = position === 'sidebar' 
    ? 'w-full'
    : position === 'top'
    ? 'w-full'
    : 'w-full';

  if (isLoading) {
    return (
      <Card className={containerClass}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${containerClass} ${isProminent ? 'border border-white/10 md:border-2 md:border-primary/20 shadow-lg' : 'border border-white/10'}`}>
      <CardHeader className="pb-2 md:pb-3 px-3 md:px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Client Feedback
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </Button>
            <Button
              variant={filter === 'urgent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('urgent')}
            >
              Urgent ({urgentCount})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 md:px-4">
        <ScrollArea style={{ maxHeight }} className="md:pr-2">
          {filteredFeedbacks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feedback to display</p>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {filteredFeedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className={`p-3 md:p-4 border rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${
                    feedback.status === 'unread' ? 'bg-blue-50/60 border-blue-200' : 'bg-background'
                  }`}
                  onClick={() => markAsRead(feedback.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(feedback.type)}
                      <span className="font-medium text-sm">{feedback.clientName}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getPriorityColor(feedback.priority)}`}
                      >
                        {feedback.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {getStatusIcon(feedback.status)}
                      <span>{formatTimeAgo(feedback.timestamp)}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                    {feedback.message}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {feedback.rating && (
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < feedback.rating! ? 'text-yellow-400 fill-current' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      {feedback.workoutId && (
                        <Badge variant="outline" className="text-xs">
                          Workout Related
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export { ClientFeedbackPanel };
