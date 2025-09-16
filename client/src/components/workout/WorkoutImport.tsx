import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { ClientData } from '@/lib/types';
import { Upload, FileText, Dumbbell, AlertCircle, Check } from 'lucide-react';

interface WorkoutImportProps {
  clients: ClientData[];
  onImported?: () => void;
}

type ParsedExercise = {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
};

export function WorkoutImport({ clients, onImported }: WorkoutImportProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'importing'>('upload');
  const [content, setContent] = useState('');
  const [workoutName, setWorkoutName] = useState('Imported Workout');
  const [clientId, setClientId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>(() => new Date().toISOString().slice(0,16));
  const [parsedExercises, setParsedExercises] = useState<ParsedExercise[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!clientId && clients && clients.length > 0) {
      setClientId(clients[0].id);
    }
  }, [clients, clientId]);

  const parseExercises = (raw: string): ParsedExercise[] => {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out: ParsedExercise[] = [];
    for (const original of lines) {
      // Normalize common unicode symbols from Samsung Notes exports
      let line = original
        .replace(/[\u00D7\u2715\u2716]/g, 'x') // × ✕ ✖ -> x
        .replace(/[\u2013\u2014]/g, '-')        // – — -> -
        .replace(/[\u00A0]/g, ' ');             // non-breaking space -> space

      // Example patterns we support:
      // Bench Press - 3x10 @ 40kg
      // Squat 4 x 8 @ 80 kg
      // Deadlift 3 sets of 5 reps at 100kg
      // Pull ups 4 x 10
      // Plank 60s
      let name = line;
      let sets: number | undefined;
      let reps: number | undefined;
      let weight: number | undefined;

      const weightMatch = line.match(/@?\s*(\d+(?:\.\d+)?)\s*(kg|lbs?)/i);
      if (weightMatch) {
        weight = parseFloat(weightMatch[1]);
        name = name.replace(weightMatch[0], '').trim();
      }

      // 1) Common "3x10" or "3 x 10"
      const setsRepsX = line.match(/(\d+)\s*[xX]\s*(\d+)/);
      if (setsRepsX) {
        sets = parseInt(setsRepsX[1], 10);
        reps = parseInt(setsRepsX[2], 10);
        name = name.replace(setsRepsX[0], '').trim();
      }

      // 2) Verbose "3 sets of 10 reps"
      if (sets === undefined && reps === undefined) {
        const setsRepsWords = line.match(/(\d+)\s*sets?\s*(?:of)?\s*(\d+)\s*reps?/i);
        if (setsRepsWords) {
          sets = parseInt(setsRepsWords[1], 10);
          reps = parseInt(setsRepsWords[2], 10);
          name = name.replace(setsRepsWords[0], '').trim();
        }
      }

      // 3) Generic two-number fallback: take first two standalone numbers as sets/reps
      if (sets === undefined && reps === undefined) {
        const matches = line.match(/\b\d{1,3}\b/g) || [];
        const nums = matches.map(s => parseInt(s, 10)).slice(0, 2);
        if (nums.length === 2) { sets = nums[0]; reps = nums[1]; }
      }

      // Clean separators like '-' ',' bullets
      name = name.replace(/[\-•|]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      if (!name) name = 'Exercise';

      out.push({ name, sets, reps, weight });
    }
    return out;
  };

  const handleTextPaste = (val: string) => {
    setContent(val);
    const parsed = parseExercises(val);
    setParsedExercises(parsed);
    if (parsed.length > 0) {
      setStep('review');
    }
  };

  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      const w = window as any;
      if (w.pdfjsLib) return resolve(w.pdfjsLib);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if (w.pdfjsLib) {
          try {
            w.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          } catch {}
          resolve(w.pdfjsLib);
        } else {
          reject(new Error('pdfjsLib not available after script load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load pdf.js'));
      document.head.appendChild(script);
    });
  };

  const loadTesseract = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      const w = window as any;
      if (w.Tesseract) return resolve(w.Tesseract);
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => w.Tesseract ? resolve(w.Tesseract) : reject(new Error('Tesseract not available'));
      script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
      document.head.appendChild(script);
    });
  };

  const ocrPageToText = async (pdfjsLib: any, page: any): Promise<string> => {
    try {
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const Tesseract = await loadTesseract();
      const result = await Tesseract.recognize(canvas, 'eng', { logger: () => {} });
      return result?.data?.text || '';
    } catch (e) {
      console.warn('OCR page failed', e);
      return '';
    }
  };

  const readPdfAsText = async (file: File) => {
    try {
      const pdfjsLib = await loadPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        try {
          const content = await page.getTextContent();
          const pageText = (content.items || []).map((item: any) => item.str).join(' ');
          text += (pageText || '') + '\n';
        } catch (e) {
          console.warn('PDF textContent failed on page', i, e);
        }
      }

      // If the extracted text is too short, this PDF is likely image-based. Try OCR fallback.
      const trimmed = (text || '').replace(/\s+/g, ' ').trim();
      if (!trimmed || trimmed.length < 10) {
        let ocrText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const t = await ocrPageToText(pdfjsLib, page);
          if (t) ocrText += t + '\n';
        }
        if (ocrText.trim().length > 0) {
          return ocrText;
        }
      }
      return text;
    } catch (e) {
      console.error('PDF parse error', e);
      toast({ title: 'PDF parsing failed', description: 'Please export your Samsung Notes as text and try again.', variant: 'destructive' });
      return '';
    }
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const txt = await readPdfAsText(file);
      if (txt) {
        setContent(txt);
        const parsed = parseExercises(txt);
        setParsedExercises(parsed);
        setStep('review');
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      setContent(text);
      const parsed = parseExercises(text);
      setParsedExercises(parsed);
      setStep(parsed.length > 0 ? 'review' : 'upload');
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Select a client');
      if (!parsedExercises.length) throw new Error('No exercises parsed');
      const response = await fetch('/api/coach/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: workoutName || 'Imported Workout',
          description: 'Imported from Samsung Notes',
          clientId,
          scheduledDate: new Date(scheduledDate).getTime(),
          exercises: parsedExercises.map(ex => ({
            name: ex.name,
            sets: ex.sets || 1,
            reps: ex.reps || 10,
            weight: typeof ex.weight === 'number' ? ex.weight : null,
          })),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || 'Failed to import workout');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Workout imported', description: `${parsedExercises.length} exercises added` });
      setOpen(false);
      setStep('upload');
      setParsedExercises([]);
      setContent('');
      onImported?.();
    },
    onError: (e: any) => {
      toast({ title: 'Import failed', description: e?.message || 'Please try again', variant: 'destructive' });
    }
  });

  const handleClose = () => {
    setOpen(false);
    setStep('upload');
    setParsedExercises([]);
    setContent('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-thrst-accent/20 hover:bg-thrst-accent/10">
          <Upload className="h-4 w-4 mr-2" />
          Import Workout (Samsung Notes)
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-morphism border-white/10 max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Dumbbell className="h-5 w-5 mr-2" />
            Import Workout from Samsung Notes
          </DialogTitle>
          <DialogDescription>
            Upload a PDF/text export from Samsung Notes or paste text. We'll parse common patterns like "Bench Press - 3x10 @ 40kg".
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Upload File (PDF / TXT / CSV / JSON)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.csv,.json"
                    onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                    className="mb-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">For best results, export as text or structured lines.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Paste Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={"Bench Press - 3x10 @ 40kg\nSquat - 4x8 @ 80kg"}
                    className="min-h-[120px] text-sm"
                    onChange={(e) => handleTextPaste(e.target.value)}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="clientSelect">Client</Label>
                <select
                  id="clientSelect"
                  className="w-full bg-background border border-white/10 rounded-md px-2 py-2 text-sm"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {[c.user?.firstName, c.user?.lastName].filter(Boolean).join(' ') || c.user?.email || c.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="workoutName">Workout Name</Label>
                <Input id="workoutName" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} placeholder="Imported Workout" />
              </div>
              <div>
                <Label htmlFor="scheduledDate">Scheduled</Label>
                <Input id="scheduledDate" type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              </div>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              You can adjust sets/reps/weight later in the workout form if needed.
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="clientSelect2">Client</Label>
                <select
                  id="clientSelect2"
                  className="w-full bg-background border border-white/10 rounded-md px-2 py-2 text-sm"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {[c.user?.firstName, c.user?.lastName].filter(Boolean).join(' ') || c.user?.email || c.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="workoutName2">Workout Name</Label>
                <Input id="workoutName2" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} placeholder="Imported Workout" />
              </div>
              <div>
                <Label htmlFor="scheduledDate2">Scheduled</Label>
                <Input id="scheduledDate2" type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Parsed Exercises ({parsedExercises.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {parsedExercises.map((ex, idx) => (
                  <div key={idx} className="flex items-center justify-between border rounded-md p-2">
                    <div className="text-sm">
                      <span className="font-medium">{ex.name}</span>
                      <span className="text-muted-foreground ml-2">
                        {(ex.sets ?? '?')} x {(ex.reps ?? '?')} {typeof ex.weight === 'number' ? `@ ${ex.weight}kg` : ''}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">Parsed</Badge>
                  </div>
                ))}
                {parsedExercises.length === 0 && (
                  <div className="text-sm text-muted-foreground">No exercises detected. Go back and adjust your text.</div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={() => importMutation.mutate()} className="bg-thrst-accent hover:bg-thrst-accent/90" disabled={importMutation.isPending || !clientId || parsedExercises.length === 0}>
                {importMutation.isPending ? 'Importing...' : 'Import Workout'}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-thrst-accent mb-4"></div>
            <p className="text-muted-foreground">Importing workout...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
