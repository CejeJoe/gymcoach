import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { authenticateToken, AuthenticatedRequest } from './auth';
import { db } from './db';
import { eq, and, desc } from 'drizzle-orm';
import { workoutSessions, workoutEntries, clients, workouts } from '@shared/mysql-schema';
import { storage } from './storage';


const router = Router();

// Create a new workout session
router.post('/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, startTime } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // If clientId is provided, verify the client belongs to this user (for coaches)
    if (clientId) {
      const client = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
      if (client.length === 0) {
        return res.status(404).json({ message: 'Client not found' });
      }
    }

    const sessionId = randomUUID();
    
    await db.insert(workoutSessions).values({
      id: sessionId,
      userId: clientId || userId, // Use clientId if provided (coach logging for client), otherwise current user
      coachId: clientId ? userId : null, // Set coachId if logging for a client
      startTime: new Date(startTime),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.json({ id: sessionId, message: 'Workout session created' });
  } catch (error) {
    console.error('Error creating workout session:', error);
    res.status(500).json({ message: 'Failed to create workout session' });
  }
});

// End a workout session
router.put('/sessions/:sessionId/end', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    await db.update(workoutSessions)
      .set({ 
        endTime: new Date(),
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(workoutSessions.id, sessionId));

    res.json({ message: 'Workout session ended' });
  } catch (error) {
    console.error('Error ending workout session:', error);
    res.status(500).json({ message: 'Failed to end workout session' });
  }
});

// Log workout entries
router.post('/entries', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, clientId, entries } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: 'No entries provided' });
    }

    const workoutEntriesToInsert = entries.map((entry: any) => ({
      id: randomUUID(),
      sessionId: sessionId || randomUUID(),
      userId: clientId || userId,
      coachId: clientId ? userId : null,
      exercise: entry.exercise || 'Unknown Exercise',
      sets: entry.sets || null,
      reps: entry.reps || null,
      weight: entry.weight || null,
      duration: entry.duration || null,
      rawText: entry.rawText || '',
      timestamp: new Date(entry.timestamp || new Date()),
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await db.insert(workoutEntries).values(workoutEntriesToInsert);

    res.json({ 
      message: 'Workout entries logged successfully',
      count: workoutEntriesToInsert.length
    });
  } catch (error) {
    console.error('Error logging workout entries:', error);
    res.status(500).json({ message: 'Failed to log workout entries' });
  }
});

// Get workout history for current user
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { clientId, limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const targetUserId = clientId as string || userId;

    // Get recent workout entries
    const entries = await db.select()
      .from(workoutEntries)
      .where(eq(workoutEntries.userId, targetUserId))
      .orderBy(desc(workoutEntries.timestamp))
      .limit(parseInt(limit as string));

    // Get recent sessions
    const sessions = await db.select()
      .from(workoutSessions)
      .where(eq(workoutSessions.userId, targetUserId))
      .orderBy(desc(workoutSessions.startTime))
      .limit(10);

    res.json({ entries, sessions });
  } catch (error) {
    console.error('Error fetching workout history:', error);
    res.status(500).json({ message: 'Failed to fetch workout history' });
  }
});

// Get workout entries for a specific session
router.get('/sessions/:sessionId/entries', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const entries = await db.select()
      .from(workoutEntries)
      .where(eq(workoutEntries.sessionId, sessionId))
      .orderBy(desc(workoutEntries.timestamp));

    res.json({ entries });
  } catch (error) {
    console.error('Error fetching session entries:', error);
    res.status(500).json({ message: 'Failed to fetch session entries' });
  }
});

// Get client workout summaries (for coaches)
router.get('/client-summaries', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Get all clients for this coach
    const coachClients = await db.select()
      .from(clients)
      .where(eq(clients.coachId, userId));

    const clientSummaries = await Promise.all(
      coachClients.map(async (client) => {
        // Get recent workout entries for this client
        const recentEntries = await db.select()
          .from(workoutEntries)
          .where(eq(workoutEntries.userId, client.userId))
          .orderBy(desc(workoutEntries.timestamp))
          .limit(10);

        // Get last session
        const lastSession = await db.select()
          .from(workoutSessions)
          .where(eq(workoutSessions.userId, client.userId))
          .orderBy(desc(workoutSessions.startTime))
          .limit(1);

        return {
          client,
          recentEntries,
          lastSession: lastSession[0] || null,
          totalWorkouts: recentEntries.length
        };
      })
    );

    res.json({ clientSummaries });
  } catch (error) {
    console.error('Error fetching client summaries:', error);
    res.status(500).json({ message: 'Failed to fetch client summaries' });
  }
});


// Get workouts for the currently logged-in client
router.get('/client', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    console.log('[workouts/client] userId:', userId, 'role:', req.user?.role);
    if (!userId || req.user.role !== 'client') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const client = await storage.getClientByUserId(userId);
    if (!client) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    const clientWorkouts = await storage.getWorkoutsByClient(client.id, { includeCompleted: true });
    console.log('[workouts/client] clientId:', client.id, 'workouts:', clientWorkouts.length);
    res.json(clientWorkouts);
  } catch (error) {
    console.error('Error fetching client workouts:', error);
    res.status(500).json({ message: 'Failed to fetch client workouts' });
  }
});

// Client completes a workout
router.post('/:workoutId/complete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { workoutId } = req.params;
    const { duration, notes } = req.body;
    const userId = req.user?.userId;

    if (!userId || req.user.role !== 'client') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const client = await storage.getClientByUserId(userId);
    if (!client) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    const workout = await storage.getWorkout(workoutId);
    if (!workout || workout.clientId !== client.id) {
      return res.status(404).json({ message: 'Workout not found or not assigned to this client' });
    }

    const completedWorkout = await storage.completeWorkout(workoutId, duration, notes);
    res.json(completedWorkout);

  } catch (error) {
    console.error('Error completing workout:', error);
    res.status(500).json({ message: 'Failed to complete workout' });
  }
});

export default router;
