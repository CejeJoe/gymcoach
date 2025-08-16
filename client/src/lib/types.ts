export interface AuthUser {
  id: string;
  email: string;
  role: 'coach' | 'client';
  firstName: string;
  lastName: string;
  avatar?: string;
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
}

export interface ClientStats {
  totalWorkouts: number;
  completedWorkouts: number;
  progressEntries: number;
  daysActive: number;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number;
  completed?: boolean;
}

export interface WorkoutData {
  id: string;
  name: string;
  description?: string;
  exercises: Exercise[];
  scheduledDate?: string;
  completedAt?: string;
  duration?: number;
  notes?: string;
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
