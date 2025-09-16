import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, Layout, Eye, EyeOff, GripVertical } from 'lucide-react';

export interface DashboardWidget {
  id: string;
  title: string;
  component: string;
  enabled: boolean;
  order: number;
  size: 'small' | 'medium' | 'large';
}

export interface DashboardPreferences {
  layout: 'grid' | 'list' | 'compact';
  widgets: DashboardWidget[];
  showClientFeedback: boolean;
  feedbackPosition: 'top' | 'sidebar' | 'bottom';
  autoRefresh: boolean;
  refreshInterval: number;
  theme: 'default' | 'minimal' | 'detailed';
}

interface DashboardCustomizationProps {
  preferences: DashboardPreferences;
  onPreferencesChange: (preferences: DashboardPreferences) => void;
}

const defaultWidgets: DashboardWidget[] = [
  { id: 'client-overview', title: 'Client Overview', component: 'ClientOverview', enabled: true, order: 1, size: 'large' },
  { id: 'recent-workouts', title: 'Recent Workouts', component: 'RecentWorkouts', enabled: true, order: 2, size: 'medium' },
  { id: 'client-feedback', title: 'Client Feedback', component: 'ClientFeedback', enabled: true, order: 3, size: 'medium' },
  { id: 'progress-charts', title: 'Progress Charts', component: 'ProgressCharts', enabled: true, order: 4, size: 'large' },
  { id: 'upcoming-sessions', title: 'Upcoming Sessions', component: 'UpcomingSessions', enabled: false, order: 5, size: 'small' },
  { id: 'client-messages', title: 'Recent Messages', component: 'ClientMessages', enabled: true, order: 6, size: 'medium' },
  { id: 'performance-metrics', title: 'Performance Metrics', component: 'PerformanceMetrics', enabled: false, order: 7, size: 'small' },
];

export default function DashboardCustomization({ preferences, onPreferencesChange }: DashboardCustomizationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<DashboardPreferences>(preferences);

  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const handleWidgetToggle = (widgetId: string, enabled: boolean) => {
    const updatedWidgets = localPreferences.widgets.map(widget =>
      widget.id === widgetId ? { ...widget, enabled } : widget
    );
    setLocalPreferences(prev => ({ ...prev, widgets: updatedWidgets }));
  };

  const handleWidgetSizeChange = (widgetId: string, size: 'small' | 'medium' | 'large') => {
    const updatedWidgets = localPreferences.widgets.map(widget =>
      widget.id === widgetId ? { ...widget, size } : widget
    );
    setLocalPreferences(prev => ({ ...prev, widgets: updatedWidgets }));
  };

  const moveWidget = (widgetId: string, direction: 'up' | 'down') => {
    const widgets = [...localPreferences.widgets];
    const currentIndex = widgets.findIndex(w => w.id === widgetId);
    
    if (direction === 'up' && currentIndex > 0) {
      [widgets[currentIndex], widgets[currentIndex - 1]] = [widgets[currentIndex - 1], widgets[currentIndex]];
    } else if (direction === 'down' && currentIndex < widgets.length - 1) {
      [widgets[currentIndex], widgets[currentIndex + 1]] = [widgets[currentIndex + 1], widgets[currentIndex]];
    }

    // Update order numbers
    widgets.forEach((widget, index) => {
      widget.order = index + 1;
    });

    setLocalPreferences(prev => ({ ...prev, widgets }));
  };

  const handleSave = () => {
    onPreferencesChange(localPreferences);
    setIsOpen(false);
  };

  const handleReset = () => {
    const resetPreferences: DashboardPreferences = {
      layout: 'grid',
      widgets: defaultWidgets,
      showClientFeedback: true,
      feedbackPosition: 'top',
      autoRefresh: true,
      refreshInterval: 30,
      theme: 'default'
    };
    setLocalPreferences(resetPreferences);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Customize Dashboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Dashboard Customization
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Layout Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Layout & Theme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dashboard Layout</Label>
                  <Select
                    value={localPreferences.layout}
                    onValueChange={(value: 'grid' | 'list' | 'compact') =>
                      setLocalPreferences(prev => ({ ...prev, layout: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid Layout</SelectItem>
                      <SelectItem value="list">List Layout</SelectItem>
                      <SelectItem value="compact">Compact Layout</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Theme Style</Label>
                  <Select
                    value={localPreferences.theme}
                    onValueChange={(value: 'default' | 'minimal' | 'detailed') =>
                      setLocalPreferences(prev => ({ ...prev, theme: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Feedback Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client Feedback Display</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Show Client Feedback Prominently</Label>
                  <p className="text-sm text-muted-foreground">
                    Display client feedback in a prominent position for quick access
                  </p>
                </div>
                <Switch
                  checked={localPreferences.showClientFeedback}
                  onCheckedChange={(checked) =>
                    setLocalPreferences(prev => ({ ...prev, showClientFeedback: checked }))
                  }
                />
              </div>
              
              {localPreferences.showClientFeedback && (
                <div className="space-y-2">
                  <Label>Feedback Position</Label>
                  <Select
                    value={localPreferences.feedbackPosition}
                    onValueChange={(value: 'top' | 'sidebar' | 'bottom') =>
                      setLocalPreferences(prev => ({ ...prev, feedbackPosition: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top of Dashboard</SelectItem>
                      <SelectItem value="sidebar">Right Sidebar</SelectItem>
                      <SelectItem value="bottom">Bottom Section</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Widget Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dashboard Widgets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {localPreferences.widgets
                  .sort((a, b) => a.order - b.order)
                  .map((widget, index) => (
                    <div
                      key={widget.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveWidget(widget.id, 'up')}
                            disabled={index === 0}
                            className="h-6 w-6 p-0"
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveWidget(widget.id, 'down')}
                            disabled={index === localPreferences.widgets.length - 1}
                            className="h-6 w-6 p-0"
                          >
                            ↓
                          </Button>
                        </div>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                          {widget.enabled ? (
                            <Eye className="h-4 w-4 text-green-600" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{widget.title}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Select
                          value={widget.size}
                          onValueChange={(value: 'small' | 'medium' | 'large') =>
                            handleWidgetSizeChange(widget.id, value)
                          }
                          disabled={!widget.enabled}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Switch
                          checked={widget.enabled}
                          onCheckedChange={(checked) => handleWidgetToggle(widget.id, checked)}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Auto-refresh Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Auto-refresh Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Auto-refresh Dashboard</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically refresh dashboard data at regular intervals
                  </p>
                </div>
                <Switch
                  checked={localPreferences.autoRefresh}
                  onCheckedChange={(checked) =>
                    setLocalPreferences(prev => ({ ...prev, autoRefresh: checked }))
                  }
                />
              </div>
              
              {localPreferences.autoRefresh && (
                <div className="space-y-2">
                  <Label>Refresh Interval (seconds)</Label>
                  <Select
                    value={localPreferences.refreshInterval.toString()}
                    onValueChange={(value) =>
                      setLocalPreferences(prev => ({ ...prev, refreshInterval: parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleReset}>
              Reset to Default
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DashboardCustomization };
