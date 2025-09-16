import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";

export type PerformedExercise = {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number | null;
  notes?: string;
};

interface SessionLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  coachId: string;
  defaultExercises?: PerformedExercise[];
}

const QUICK_PRESETS: PerformedExercise[] = [
  { name: "Lunges", sets: 3, reps: 12 },
  { name: "Hip Thrusts", sets: 4, reps: 10 },
  { name: "Glute Bridge", sets: 3, reps: 15 },
];

export default function SessionLogDialog({ open, onOpenChange, clientId, coachId, defaultExercises = [] }: SessionLogDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [performed, setPerformed] = useState<PerformedExercise[]>(defaultExercises);
  const [customName, setCustomName] = useState("");
  const [duration, setDuration] = useState<number | ''>('');
  const [notes, setNotes] = useState("");

  // Simple local presets (localStorage)
  type ExercisePreset = { name: string; sets?: number; reps?: number };
  const PRESET_KEY = 'gc_exercise_presets_v1';
  const readPresets = (): ExercisePreset[] => {
    try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '[]'); } catch { return []; }
  };
  const writePresets = (arr: ExercisePreset[]) => {
    localStorage.setItem(PRESET_KEY, JSON.stringify(arr.slice(0, 50)));
  };
  const [presets, setPresets] = useState<ExercisePreset[]>(readPresets());
  const refreshPresets = () => setPresets(readPresets());
  const savePreset = (p: ExercisePreset) => {
    if (!p.name?.trim()) return;
    const current = readPresets();
    const dedup = [p, ...current.filter(x => x.name.toLowerCase() !== p.name.toLowerCase())];
    writePresets(dedup);
    refreshPresets();
    toast({ title: 'Preset saved', description: `${p.name}` });
  };
  const removePreset = (name: string) => {
    writePresets(readPresets().filter(p => p.name.toLowerCase() !== name.toLowerCase()));
    refreshPresets();
  };

  const addExercise = (ex: PerformedExercise) => {
    if (!ex.name.trim()) return;
    setPerformed((prev) => [...prev, { ...ex, sets: ex.sets ?? 1, reps: ex.reps ?? 1 }]);
  };

  const removeExercise = (idx: number) => {
    setPerformed((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSubmit = useMemo(() => performed.length > 0, [performed.length]);

  const createLog = useMutation({
    mutationFn: async () => {
      const body = {
        performed,
        duration: typeof duration === 'number' ? duration : undefined,
        notes: notes?.trim() ? notes.trim() : undefined,
      } as any;

      const res = await fetch(`/api/coach/clients/${clientId}/session-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Failed to create session log');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Session saved', description: 'Session log created successfully.' });
      qc.invalidateQueries({ queryKey: ['/api/coach/clients', clientId, 'session-logs'] }).catch(() => undefined);
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e?.message || 'Could not save session', variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-morphism border-white/10 max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Log Session</DialogTitle>
          <DialogDescription>Add performed exercises for this client.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Your presets */}
          <div>
            <Label className="text-xs">Your presets</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.length === 0 && (
                <span className="text-xs text-muted-foreground">No presets yet</span>
              )}
              {presets.map((p, i) => (
                <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => addExercise({ name: p.name, sets: p.sets ?? 3, reps: p.reps ?? 10 })}>
                  + {p.name}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Quick add</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_PRESETS.map((p, i) => (
                <Badge key={i} variant="outline" className="cursor-pointer" onClick={() => addExercise(p)}>
                  + {p.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label htmlFor="custom-ex">Custom exercise</Label>
              <Input id="custom-ex" placeholder="e.g., Bulgarian Split Squat" value={customName} onChange={(e) => setCustomName(e.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={() => { if (customName.trim()) { addExercise({ name: customName.trim(), sets: 3, reps: 10 }); setCustomName(""); } }}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
            <Button type="button" variant="ghost" onClick={() => { if (customName.trim()) { savePreset({ name: customName.trim(), sets: 3, reps: 10 }); setCustomName(""); } }}>
              Save as preset
            </Button>
          </div>

          <div className="space-y-3">
            {performed.map((ex, idx) => (
              <div key={idx} className="p-3 border rounded-md">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{ex.name}</div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => savePreset({ name: ex.name, sets: ex.sets, reps: ex.reps })}>Save preset</Button>
                    <Button variant="ghost" size="icon" onClick={() => removeExercise(idx)} aria-label="Remove exercise">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <Label className="text-xs">Sets</Label>
                    <Input type="number" min={1} value={ex.sets ?? 1} onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value || '1'));
                      setPerformed((prev) => prev.map((p, i) => i === idx ? { ...p, sets: v } : p));
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Reps</Label>
                    <Input type="number" min={1} value={ex.reps ?? 1} onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value || '1'));
                      setPerformed((prev) => prev.map((p, i) => i === idx ? { ...p, reps: v } : p));
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input type="number" min={0} step={0.5} value={ex.weight ?? ''} onChange={(e) => {
                      const raw = e.target.value;
                      const v = raw === '' ? null : Number(raw);
                      setPerformed((prev) => prev.map((p, i) => i === idx ? { ...p, weight: isNaN(v as number) ? null : (v as number) } : p));
                    }} />
                  </div>
                </div>
                <div className="mt-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={ex.notes ?? ''} onChange={(e) => setPerformed((prev) => prev.map((p, i) => i === idx ? { ...p, notes: e.target.value } : p))} placeholder="Form cues, RPE, etc." />
                </div>
              </div>
            ))}
            {performed.length === 0 && (
              <div className="text-sm text-muted-foreground">No exercises yet. Use quick add or add a custom exercise.</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" min={0} value={duration} onChange={(e) => {
                const v = e.target.value;
                setDuration(v === '' ? '' : Math.max(0, parseInt(v)));
              }} />
            </div>
            <div>
              <Label>Session Notes</Label>
              <Textarea placeholder="How did it go?" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => createLog.mutate()} disabled={!canSubmit || createLog.isPending} className="bg-thrst-green hover:bg-thrst-green/90">
              {createLog.isPending ? 'Saving...' : 'Save Session'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
