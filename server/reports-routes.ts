import { Router, type Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from './auth';
import { storage } from './storage';

const router = Router();

// Get comprehensive dashboard report data from real database
router.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'coach') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const coachId = req.user.userId;
    
    // Get real data from database
    const { clients } = await storage.getClientsByCoach(coachId, { isActive: true });
    const coachStats = await storage.getCoachStats(coachId);
    
    // Build client progress data from real database
    const clientProgress = await Promise.all(
      clients.map(async (client: any) => {
        const clientStats = await storage.getClientStats(client.id);
        const progressEntries = await storage.getProgressByClient(client.id);
        
        // Calculate weight and body fat changes
        let weightChange: number | null = null;
        let bodyFatChange: number | null = null;
        
        if (progressEntries.length >= 2) {
          const sortedProgress = [...progressEntries].sort((a, b) => 
            (a.date?.getTime() || 0) - (b.date?.getTime() || 0)
          );
          const first = sortedProgress[0];
          const last = sortedProgress[sortedProgress.length - 1];
          
          if (first.weight && last.weight) {
            weightChange = Number(last.weight) - Number(first.weight);
          }
          if (first.bodyFat && last.bodyFat) {
            bodyFatChange = Number(last.bodyFat) - Number(first.bodyFat);
          }
        }
        
        return {
          clientId: client.id,
          clientName: `${client.user?.firstName || ''} ${client.user?.lastName || ''}`.trim() || 'Unknown Client',
          totalWorkouts: clientStats.totalWorkouts,
          completedWorkouts: clientStats.completedWorkouts,
          progressPercentage: clientStats.totalWorkouts > 0 
            ? Math.round((clientStats.completedWorkouts / clientStats.totalWorkouts) * 100)
            : 0,
          lastWorkoutDate: clientStats.lastWorkoutDate?.toISOString() || null,
          weightChange,
          bodyFatChange
        };
      })
    );
    
    // Calculate workout trends from recent workouts
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const allWorkouts = await storage.getWorkoutsByCoach(coachId, {
      startDate,
      endDate,
      includeCompleted: true
    });
    
    // Group workouts by day for trends
    const workoutsByDay: { [key: string]: { completed: number; scheduled: number } } = {};
    
    allWorkouts.forEach(workout => {
      const date = workout.scheduledDate || workout.createdAt;
      if (!date) return;
      
      const dayKey = date.toISOString().split('T')[0];
      if (!workoutsByDay[dayKey]) {
        workoutsByDay[dayKey] = { completed: 0, scheduled: 0 };
      }
      
      workoutsByDay[dayKey].scheduled++;
      if (workout.completedAt) {
        workoutsByDay[dayKey].completed++;
      }
    });
    
    const workoutTrends = Object.entries(workoutsByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7) // Last 7 days
      .map(([date, data]) => ({
        // Return ISO-like day key; client will format for display
        date,
        completed: data.completed,
        scheduled: data.scheduled
      }));
    
    // Performance metrics from real data
    const performanceMetrics = {
      totalClients: coachStats.totalClients,
      activeClients: coachStats.activeClients,
      avgCompletionRate: coachStats.totalClients > 0 
        ? Math.round((coachStats.completedWorkouts / Math.max(allWorkouts.length, 1)) * 100)
        : 0,
      totalWorkouts: allWorkouts.length,
      completedWorkouts: coachStats.completedWorkouts
    };
    
    // Simple client retention data (this would need more complex logic for real retention tracking)
    const clientRetention = [
      { 
        month: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        retained: coachStats.activeClients,
        new: Math.max(0, coachStats.totalClients - coachStats.activeClients),
        churned: 0
      }
    ];
    
    const reportData = {
      clientProgress,
      workoutTrends,
      performanceMetrics,
      clientRetention
    };

    res.json(reportData);
  } catch (error) {
    console.error('Dashboard report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Export reports (CSV) with real data
router.get('/export/csv', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'coach') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const coachId = req.user.userId;
    const { clients } = await storage.getClientsByCoach(coachId, { isActive: true });
    
    // Build CSV data from real database
    let csvData = 'Client Name,Total Workouts,Completed Workouts,Progress %,Weight Change\n';
    
    for (const client of clients as any[]) {
      const clientStats = await storage.getClientStats(client.id);
      const progressEntries = await storage.getProgressByClient(client.id);
      
      let weightChange = 'N/A';
      if (progressEntries.length >= 2) {
        const sortedProgress = [...progressEntries].sort((a, b) => 
          (a.date?.getTime() || 0) - (b.date?.getTime() || 0)
        );
        const first = sortedProgress[0];
        const last = sortedProgress[sortedProgress.length - 1];
        
        if (first.weight && last.weight) {
          const change = Number(last.weight) - Number(first.weight);
          weightChange = `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`;
        }
      }
      
      const clientName = `${client.user?.firstName || ''} ${client.user?.lastName || ''}`.trim() || 'Unknown Client';
      const progressPercentage = clientStats.totalWorkouts > 0 
        ? Math.round((clientStats.completedWorkouts / clientStats.totalWorkouts) * 100)
        : 0;
      
      csvData += `"${clientName}",${clientStats.totalWorkouts},${clientStats.completedWorkouts},${progressPercentage}%,"${weightChange}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="gym-coach-report.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Export reports (PDF)
router.get('/export/pdf', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'coach') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const coachId = req.user.userId;
    const { clients } = await storage.getClientsByCoach(coachId, { isActive: true });
    
    // Generate HTML content for PDF
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Gym Coach Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .client-section { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; }
            .client-name { font-size: 18px; font-weight: bold; color: #333; }
            .stats { display: flex; gap: 20px; margin-top: 10px; }
            .stat { background: #f5f5f5; padding: 10px; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Gym Coach Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
    `;
    
    // Add client data
    for (const client of clients as any[]) {
      const clientStats = await storage.getClientStats(client.id);
      const progressEntries = await storage.getProgressByClient(client.id);
      
      let weightChange = 'N/A';
      if (progressEntries.length >= 2) {
        const sortedProgress = [...progressEntries].sort((a, b) => 
          (a.date?.getTime() || 0) - (b.date?.getTime() || 0)
        );
        const first = sortedProgress[0];
        const last = sortedProgress[sortedProgress.length - 1];
        
        if (first.weight && last.weight) {
          const change = Number(last.weight) - Number(first.weight);
          weightChange = `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`;
        }
      }
      
      const clientName = `${client.user?.firstName || ''} ${client.user?.lastName || ''}`.trim() || 'Unknown Client';
      const progressPercentage = clientStats.totalWorkouts > 0 
        ? Math.round((clientStats.completedWorkouts / clientStats.totalWorkouts) * 100)
        : 0;
      
      htmlContent += `
        <div class="client-section">
            <div class="client-name">${clientName}</div>
            <div class="stats">
                <div class="stat">
                    <strong>Total Workouts:</strong> ${clientStats.totalWorkouts}
                </div>
                <div class="stat">
                    <strong>Completed:</strong> ${clientStats.completedWorkouts}
                </div>
                <div class="stat">
                    <strong>Progress:</strong> ${progressPercentage}%
                </div>
                <div class="stat">
                    <strong>Weight Change:</strong> ${weightChange}
                </div>
            </div>
        </div>
      `;
    }
    
    htmlContent += `
        <table>
            <thead>
                <tr>
                    <th>Client Name</th>
                    <th>Total Workouts</th>
                    <th>Completed Workouts</th>
                    <th>Progress %</th>
                    <th>Weight Change</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add table rows
    for (const client of clients as any[]) {
      const clientStats = await storage.getClientStats(client.id);
      const progressEntries = await storage.getProgressByClient(client.id);
      
      let weightChange = 'N/A';
      if (progressEntries.length >= 2) {
        const sortedProgress = [...progressEntries].sort((a, b) => 
          (a.date?.getTime() || 0) - (b.date?.getTime() || 0)
        );
        const first = sortedProgress[0];
        const last = sortedProgress[sortedProgress.length - 1];
        
        if (first.weight && last.weight) {
          const change = Number(last.weight) - Number(first.weight);
          weightChange = `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`;
        }
      }
      
      const clientName = `${client.user?.firstName || ''} ${client.user?.lastName || ''}`.trim() || 'Unknown Client';
      const progressPercentage = clientStats.totalWorkouts > 0 
        ? Math.round((clientStats.completedWorkouts / clientStats.totalWorkouts) * 100)
        : 0;
      
      htmlContent += `
                <tr>
                    <td>${clientName}</td>
                    <td>${clientStats.totalWorkouts}</td>
                    <td>${clientStats.completedWorkouts}</td>
                    <td>${progressPercentage}%</td>
                    <td>${weightChange}</td>
                </tr>
      `;
    }
    
    htmlContent += `
            </tbody>
        </table>
    </body>
    </html>
    `;

    // Return HTML content as PDF-like response
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'inline; filename="gym-coach-report.html"');
    res.send(htmlContent);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
