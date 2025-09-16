import { Router, type Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "thrst-gym-secret-key";

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

// JWT Authentication middleware
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      console.error('JWT verification error:', err);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };
    next();
  });
};

// Get comprehensive dashboard report data with mock data
router.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'coach') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const days = parseInt(req.query.days as string) || 30;
    
    // Mock data for reports dashboard
    const reportData = {
      clientProgress: [
        {
          clientId: "client1",
          clientName: "John Doe",
          totalWorkouts: 12,
          completedWorkouts: 10,
          progressPercentage: 83,
          lastWorkoutDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          weightChange: -2.5,
          bodyFatChange: -1.2
        },
        {
          clientId: "client2", 
          clientName: "Jane Smith",
          totalWorkouts: 15,
          completedWorkouts: 14,
          progressPercentage: 93,
          lastWorkoutDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          weightChange: -3.1,
          bodyFatChange: -2.0
        },
        {
          clientId: "client3",
          clientName: "Mike Johnson", 
          totalWorkouts: 8,
          completedWorkouts: 6,
          progressPercentage: 75,
          lastWorkoutDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          weightChange: -1.8,
          bodyFatChange: -0.8
        }
      ],
      workoutTrends: [
        { date: "Dec 2", completed: 8, scheduled: 12 },
        { date: "Dec 3", completed: 10, scheduled: 14 },
        { date: "Dec 4", completed: 12, scheduled: 15 },
        { date: "Dec 5", completed: 9, scheduled: 13 },
        { date: "Dec 6", completed: 11, scheduled: 16 },
        { date: "Dec 7", completed: 13, scheduled: 17 },
        { date: "Dec 8", completed: 15, scheduled: 18 }
      ],
      performanceMetrics: {
        totalClients: 3,
        activeClients: 2,
        avgCompletionRate: 84,
        totalWorkouts: 35,
        completedWorkouts: 30
      },
      clientRetention: [
        { month: "Jul 2024", retained: 3, new: 3, churned: 0 },
        { month: "Aug 2024", retained: 3, new: 1, churned: 1 },
        { month: "Sep 2024", retained: 3, new: 0, churned: 0 },
        { month: "Oct 2024", retained: 3, new: 2, churned: 1 },
        { month: "Nov 2024", retained: 4, new: 1, churned: 0 },
        { month: "Dec 2024", retained: 5, new: 0, churned: 1 }
      ]
    };

    res.json(reportData);
  } catch (error) {
    console.error('Dashboard report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Export reports (CSV)
router.get('/export/csv', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'coach') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Simple CSV export
    const csvData = `Client Name,Total Workouts,Completed Workouts,Progress %,Weight Change
John Doe,12,10,83%,-2.5 lbs
Jane Smith,15,14,93%,-3.1 lbs
Mike Johnson,8,6,75%,-1.8 lbs`;
        const sortedMeasurements = measurements
          .filter(m => m.createdAt !== null)
          .sort((a, b) => (b.createdAt!.getTime()) - (a.createdAt!.getTime()));
        const latestWeight = sortedMeasurements[0]?.weight;
        const earliestWeight = sortedMeasurements[sortedMeasurements.length - 1]?.weight;
        const weightChange = latestWeight && earliestWeight ? latestWeight - earliestWeight : 0;
        
        const user = await storage.getUser(client.userId);
        const clientName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown Client';
        
        csvContent += `"${clientName}",${totalWorkouts},${completedWorkouts},${progressPercentage},"${lastWorkout?.completedAt?.toLocaleDateString() || 'N/A'}",${weightChange}\n`;
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="coach-report-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else if (format === 'pdf') {
      // For PDF, we'll return a simple text report (in a real app, you'd use a PDF library)
      const { clients } = await storage.getClientsByCoach(req.user.userId);
      
      let reportContent = `Coach Performance Report\nGenerated: ${new Date().toLocaleDateString()}\n\n`;
      reportContent += `Total Clients: ${clients.length}\n\n`;
      
      for (const client of clients) {
        const workouts = await storage.getWorkoutsByClient(client.id);
        const completedWorkouts = workouts.filter(w => w.completedAt).length;
        const totalWorkouts = workouts.length;
        const progressPercentage = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
        
        // Get user details for client name
        const user = await storage.getUser(client.userId);
        const clientName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown Client';
        
        reportContent += `${clientName}:\n`;
        reportContent += `  - Total Workouts: ${totalWorkouts}\n`;
        reportContent += `  - Completed: ${completedWorkouts}\n`;
        reportContent += `  - Progress: ${progressPercentage}%\n\n`;
      }
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="coach-report-${new Date().toISOString().split('T')[0]}.txt"`);
      res.send(reportContent);
    } else {
      res.status(400).json({ message: 'Invalid format. Use csv or pdf.' });
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ message: 'Failed to export report' });
  }
});

export default router;
