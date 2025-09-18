import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAuthHeaders } from '@/lib/auth';
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Calendar, 
  Target,
  Download,
  BarChart3,
  PieChart,
  Activity,
  Award
} from 'lucide-react';

interface ReportData {
  clientProgress: Array<{
    clientId: string;
    clientName: string;
    totalWorkouts: number;
    completedWorkouts: number;
    progressPercentage: number;
    lastWorkoutDate: string | null;
    weightChange: number | null;
    bodyFatChange: number | null;
  }>;
  workoutTrends: Array<{
    date: string;
    completed: number;
    scheduled: number;
  }>;
  performanceMetrics: {
    totalClients: number;
    activeClients: number;
    avgCompletionRate: number;
    totalWorkouts: number;
    completedWorkouts: number;
  };
  clientRetention: Array<{
    month: string;
    retained: number;
    new: number;
    churned: number;
  }>;
}

interface ReportsDashboardProps {
  coachId: string;
}

export function ReportsDashboard({ coachId }: ReportsDashboardProps) {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    fetchReportData();
  }, [coachId, dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/dashboard?days=${dateRange}`, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        console.error('Reports API error:', response.status, response.statusText);
        setReportData(null);
      }
    } catch (error) {
      console.error('Failed to fetch report data:', error);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'csv') => {
    try {
      const endpoint = format === 'csv' ? '/api/reports/export/csv' : '/api/reports/export/pdf';
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        console.error('Export failed:', response.status, response.statusText);
        return;
      }

      if (format === 'csv') {
        const text = await response.text();
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `coach-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        // Server returns HTML content; download as .html or open in new tab
        const html = await response.text();
        const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `coach-report-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load report data</p>
        <Button onClick={fetchReportData} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Performance Reports</h2>
          <p className="text-muted-foreground">Comprehensive analytics and insights</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 3 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => exportReport('pdf')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button onClick={() => exportReport('csv')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics: 2 columns on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 w-full">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.performanceMetrics.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {reportData.performanceMetrics.activeClients} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.performanceMetrics.avgCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {reportData.performanceMetrics.completedWorkouts} of {reportData.performanceMetrics.totalWorkouts} workouts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workouts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.performanceMetrics.totalWorkouts}</div>
            <p className="text-xs text-muted-foreground">
              {reportData.performanceMetrics.completedWorkouts} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData.clientProgress.length > 0 
                ? reportData.clientProgress.sort((a, b) => b.progressPercentage - a.progressPercentage)[0]?.clientName || 'N/A'
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {reportData.clientProgress.length > 0 
                ? `${reportData.clientProgress.sort((a, b) => b.progressPercentage - a.progressPercentage)[0]?.progressPercentage || 0}% completion`
                : 'No data'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList className="w-full overflow-x-auto whitespace-nowrap">
          <TabsTrigger className="shrink-0" value="progress">Client Progress</TabsTrigger>
          <TabsTrigger className="shrink-0" value="trends">Workout Trends</TabsTrigger>
          <TabsTrigger className="shrink-0" value="retention">Client Retention</TabsTrigger>
          <TabsTrigger className="shrink-0" value="performance">Performance Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Progress Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.clientProgress.map((client) => (
                  <div key={client.clientId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{client.clientName}</h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{client.completedWorkouts}/{client.totalWorkouts} workouts</span>
                        {client.lastWorkoutDate && (
                          <span>Last: {new Date(client.lastWorkoutDate).toLocaleDateString()}</span>
                        )}
                        {client.weightChange !== null && (
                          <span className={client.weightChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                            Weight: {client.weightChange > 0 ? '+' : ''}{client.weightChange}kg
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{client.progressPercentage}%</div>
                      <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(client.progressPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Workout Completion Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {reportData.workoutTrends.reduce((sum, day) => sum + day.completed, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Completed</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {reportData.workoutTrends.reduce((sum, day) => sum + day.scheduled, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Scheduled</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round((reportData.workoutTrends.reduce((sum, day) => sum + day.completed, 0) / 
                        Math.max(reportData.workoutTrends.reduce((sum, day) => sum + day.scheduled, 0), 1)) * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Completion Rate</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {reportData.workoutTrends.slice(-7).map((day) => (
                    <div key={day.date} className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm font-medium">{new Date(day.date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-500 rounded"></div>
                          <span className="text-sm">Completed: {day.completed}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded"></div>
                          <span className="text-sm">Scheduled: {day.scheduled}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Client Retention Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.clientRetention.map((month) => (
                  <div key={month.month} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{month.month}</h4>
                      <Badge variant="outline">
                        {month.retained + month.new - month.churned} Total
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{month.retained}</div>
                        <div className="text-muted-foreground">Retained</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{month.new}</div>
                        <div className="text-muted-foreground">New</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-600">{month.churned}</div>
                        <div className="text-muted-foreground">Churned</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Completion Rate Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="relative w-32 h-32">
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="3"
                          strokeDasharray={`${reportData.performanceMetrics.avgCompletionRate}, 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold">{reportData.performanceMetrics.avgCompletionRate}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {reportData.performanceMetrics.completedWorkouts}
                      </div>
                      <div className="text-sm text-muted-foreground">Completed</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-600">
                        {reportData.performanceMetrics.totalWorkouts - reportData.performanceMetrics.completedWorkouts}
                      </div>
                      <div className="text-sm text-muted-foreground">Pending</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Client Engagement</span>
                  <Badge variant={reportData.performanceMetrics.avgCompletionRate > 75 ? 'default' : 'secondary'}>
                    {reportData.performanceMetrics.avgCompletionRate > 75 ? 'Excellent' : 'Good'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Workout Consistency</span>
                  <Badge variant={reportData.workoutTrends.length > 0 ? 'default' : 'secondary'}>
                    {reportData.workoutTrends.length > 0 ? 'Active' : 'Low'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Client Growth</span>
                  <div className="flex items-center gap-1">
                    {reportData.clientRetention.length > 0 && 
                     reportData.clientRetention[reportData.clientRetention.length - 1]?.new > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">
                      {reportData.clientRetention.length > 0 
                        ? reportData.clientRetention[reportData.clientRetention.length - 1]?.new || 0
                        : 0
                      } new this month
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
