export interface AuthUser {
  id: string;
  email: string;
  role: 'coach' | 'client' | 'admin';
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface CoachStats {
  totalClients: number;
  activeClients: number;
  completedWorkouts: number;
  avgProgress: number;
  recentWorkouts?: any[];
  upcomingWorkouts?: any[];
}

export interface ClientStats {
  totalWorkouts: number;
  completedWorkouts: number;
  progressEntries: number;
  daysActive: number;
}

export interface Exercise {
  id?: string;
  name: string;
  // Free-text details (e.g., "10 reps, 2 sets" or any description)
  sets: string;
  // Optional flags/text for UI; no numeric enforcement
  comment?: string;
  completed?: boolean;
}

export interface WorkoutData {
  id: string;
  clientId: string;
  coachId: string;
  name: string;
  description?: string;
  exercises: Exercise[];
  scheduledDate?: string;
  completedAt?: string;
  duration?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProgressData {
  id: string;
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  photos?: string[];
  measurements?: Record<string, number>;
  notes?: string;
  date: string;
}

export interface ClientData {
  id: string;
  userId: string;
  coachId: string;
  goals?: Record<string, any>;
  currentWeight?: number;
  targetWeight?: number;
  height?: number;
  startDate: string;
  isActive: boolean;
  user?: AuthUser;
}

// Messaging
export interface Message {
  id: string;
  coachId: string;
  clientId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  // Optional broadcast-linked fields (present if this message came from a group broadcast)
  groupMessageId?: string;
  groupMessageTitle?: string | null;
  requiresConfirmation?: boolean;
  confirmedAt?: string | null;
  workoutId?: string | null;
  workoutName?: string | null;
}

export interface NewMessage {
  coachId: string;
  clientId: string;
  body: string;
}
