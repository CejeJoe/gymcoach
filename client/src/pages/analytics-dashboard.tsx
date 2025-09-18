import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/glass-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAuthHeaders } from "@/lib/auth";
import { AuthUser } from "@/lib/types";
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Target,
  Users,
  Dumbbell
} from "lucide-react";

interface AnalyticsDashboardProps {
  user: AuthUser;
}

export default function AnalyticsDashboard({ user }: AnalyticsDashboardProps) {
  const { data: stats } = useQuery({
    queryKey: ['/api/coach/stats'],
    queryFn: async () => {
      const response = await fetch('/api/coach/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  return (
    <div className="p-4 space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold">Reports</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Track performance and insights</p>
        </div>
      </div>

      {/* Key Metrics (responsive) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-4 w-full">
        <GlassCard className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-thrst-green/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-thrst-green" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Client Growth</p>
              <p className="text-lg sm:text-xl font-bold">+15%</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Target className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Goals Achieved</p>
              <p className="text-lg sm:text-xl font-bold">89%</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Charts Placeholder */}
      <GlassCard className="p-4 sm:p-6">
        <Tabs defaultValue="progress" className="space-y-4">
          <TabsList className="w-full overflow-x-auto whitespace-nowrap">
            <TabsTrigger value="progress">Client Progress</TabsTrigger>
            <TabsTrigger value="trends">Workout Trends</TabsTrigger>
            <TabsTrigger value="retention">Client Retention</TabsTrigger>
            <TabsTrigger value="performance">Performance Analysis</TabsTrigger>
          </TabsList>
          <CardContent className="px-0">
            <div className="h-40 sm:h-56 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs sm:text-sm text-muted-foreground">Chart visualization coming soon</p>
              </div>
            </div>
          </CardContent>
        </Tabs>
      </GlassCard>

      {/* Recent Activity */}
      <GlassCard className="p-4">
        <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Dumbbell className="h-4 w-4 text-thrst-green" />
            <span className="text-xs sm:text-sm">Sarah completed Leg Day workout</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto">2h ago</span>
          </div>
          <div className="flex items-center space-x-3">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-xs sm:text-sm">New client John joined</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto">5h ago</span>
          </div>
          <div className="flex items-center space-x-3">
            <Target className="h-4 w-4 text-purple-500" />
            <span className="text-xs sm:text-sm">Mike achieved weight loss goal</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto">1d ago</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}