import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Users, Check, X, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";

interface ParsedClient {
  firstName: string;
  lastName: string;
  email: string;
  goals?: string;
  currentWeight?: number;
  targetWeight?: number;
  height?: number;
  phone?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

interface ClientImportProps {
  onImportComplete: () => void;
}

export function ClientImport({ onImportComplete }: ClientImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'review' | 'importing'>('upload');
  const [parsedClients, setParsedClients] = useState<ParsedClient[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (clients: ParsedClient[]) => {
      const validClients = clients.filter(client => client.isValid);
      
      const response = await fetch('/api/coach/clients/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          clients: validClients.map(client => ({
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            goals: client.goals,
            currentWeight: client.currentWeight,
            targetWeight: client.targetWeight,
            height: client.height,
          }))
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import clients');
      }

      return await response.json();
    },
    onSuccess: (results) => {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${results.success} clients${results.failed > 0 ? `, ${results.failed} failed` : ''}`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/coach/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coach/stats'] });
      onImportComplete();
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import clients",
        variant: "destructive",
      });
    },
  });

  const parseTextContent = (content: string): ParsedClient[] => {
    const clients: ParsedClient[] = [];
    
    // Try different parsing strategies
    
    // Strategy 1: JSON format
    try {
      const jsonData = JSON.parse(content);
      if (Array.isArray(jsonData)) {
        return jsonData.map(parseClientObject);
      } else if (jsonData.clients && Array.isArray(jsonData.clients)) {
        return jsonData.clients.map(parseClientObject);
      }
    } catch (e) {
      // Not JSON, continue with other strategies
    }

    // Strategy 2: CSV-like format
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 1 && lines[0].includes(',')) {
      return parseCSVFormat(lines);
    }

    // Strategy 3: Samsung Notes text format (structured text blocks)
    return parseStructuredText(content);
  };

  const parseClientObject = (obj: any): ParsedClient => {
    const errors: string[] = [];
    
    const firstName = String(obj.firstName || obj.first_name || obj.name?.split(' ')[0] || '').trim();
    const lastName = String(obj.lastName || obj.last_name || obj.name?.split(' ').slice(1).join(' ') || '').trim();
    const email = String(obj.email || '').trim();
    
    if (!firstName) errors.push('First name is required');
    if (!lastName) errors.push('Last name is required');
    if (!email) errors.push('Email is required');
    if (email && !email.includes('@')) errors.push('Invalid email format');

    return {
      firstName,
      lastName,
      email,
      goals: obj.goals || obj.notes || obj.description || '',
      currentWeight: parseNumber(obj.currentWeight || obj.current_weight || obj.weight),
      targetWeight: parseNumber(obj.targetWeight || obj.target_weight || obj.goal_weight),
      height: parseNumber(obj.height),
      phone: obj.phone || obj.phoneNumber || '',
      notes: obj.notes || obj.additionalNotes || '',
      isValid: errors.length === 0,
      errors,
    };
  };

  const parseCSVFormat = (lines: string[]): ParsedClient[] => {
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const clients: ParsedClient[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj: any = {};
      
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });

      clients.push(parseClientObject(obj));
    }

    return clients;
  };

  const parseStructuredText = (content: string): ParsedClient[] => {
    console.log('[IMPORT DEBUG] Parsing content:', content.substring(0, 200) + '...');
    const clients: ParsedClient[] = [];
    
    // Split by double newlines or common separators
    const blocks = content.split(/\n\s*\n|\n---+\n|\n===+\n/).filter(block => block.trim());
    console.log('[IMPORT DEBUG] Found blocks:', blocks.length);
    
    for (const block of blocks) {
      console.log('[IMPORT DEBUG] Processing block:', block);
      const client = parseTextBlock(block);
      if (client) {
        console.log('[IMPORT DEBUG] Parsed client from block:', client);
        clients.push(client);
      }
    }

    // If no blocks found, try line-by-line parsing
    if (clients.length === 0) {
      console.log('[IMPORT DEBUG] No blocks found, trying line-by-line parsing');
      const lines = content.split('\n').filter(line => line.trim());
      let currentClient: any = {};
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        console.log('[IMPORT DEBUG] Processing line:', trimmed);

        // Look for patterns like "Name: John Doe" or "Email: john@example.com"
        const colonMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
        if (colonMatch) {
          const [, key, value] = colonMatch;
          const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
          console.log('[IMPORT DEBUG] Found key-value:', normalizedKey, '=', value);
          
          if (normalizedKey.includes('name')) {
            const nameParts = value.split(' ');
            currentClient.firstName = nameParts[0] || '';
            currentClient.lastName = nameParts.slice(1).join(' ') || '';
          } else if (normalizedKey.includes('email')) {
            currentClient.email = value;
          } else if (normalizedKey.includes('weight')) {
            if (normalizedKey.includes('current') || normalizedKey.includes('present')) {
              currentClient.currentWeight = parseNumber(value);
            } else if (normalizedKey.includes('target') || normalizedKey.includes('goal')) {
              currentClient.targetWeight = parseNumber(value);
            }
          } else if (normalizedKey.includes('height')) {
            currentClient.height = parseNumber(value);
          } else if (normalizedKey.includes('goal') || normalizedKey.includes('note')) {
            currentClient.goals = value;
          }
        } else if (trimmed.includes('@') && !currentClient.email) {
          // Standalone email
          console.log('[IMPORT DEBUG] Found standalone email:', trimmed);
          currentClient.email = trimmed;
        } else if (currentClient.firstName && currentClient.email) {
          // Start new client
          console.log('[IMPORT DEBUG] Completing client:', currentClient);
          clients.push(parseClientObject(currentClient));
          currentClient = {};
        }
      }
      
      // Add last client if exists
      if (currentClient.firstName && currentClient.email) {
        console.log('[IMPORT DEBUG] Adding final client:', currentClient);
        clients.push(parseClientObject(currentClient));
      }
    }

    console.log('[IMPORT DEBUG] Final parsed clients:', clients);
    return clients;
  };

  const parseTextBlock = (block: string): ParsedClient | null => {
    console.log('[IMPORT DEBUG] parseTextBlock input:', block);
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length === 0) return null;

    const client: any = {};
    
    for (const line of lines) {
      console.log('[IMPORT DEBUG] Processing line in block:', line);
      
      // Email detection
      const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch && !client.email) {
        client.email = emailMatch[1];
        console.log('[IMPORT DEBUG] Found email:', client.email);
        continue;
      }

      // Name detection (first line that looks like a name and doesn't contain special chars)
      if (!client.firstName && line.match(/^[A-Za-z\s]{2,50}$/) && !line.includes('@') && !line.includes(':')) {
        const nameParts = line.split(' ').filter(part => part.trim());
        client.firstName = nameParts[0] || '';
        client.lastName = nameParts.slice(1).join(' ') || '';
        console.log('[IMPORT DEBUG] Found name:', client.firstName, client.lastName);
        continue;
      }

      // Weight detection - more flexible patterns
      const currentWeightMatch = line.match(/(?:current|present).*?(\d+(?:\.\d+)?)\s*(?:kg|lbs?|pounds?)/i) ||
                                line.match(/(\d+(?:\.\d+)?)\s*(?:kg|lbs?|pounds?).*?(?:current|present)/i);
      if (currentWeightMatch && !client.currentWeight) {
        client.currentWeight = parseFloat(currentWeightMatch[1]);
        console.log('[IMPORT DEBUG] Found current weight:', client.currentWeight);
        continue;
      }

      const targetWeightMatch = line.match(/(?:target|goal).*?(\d+(?:\.\d+)?)\s*(?:kg|lbs?|pounds?)/i) ||
                               line.match(/(\d+(?:\.\d+)?)\s*(?:kg|lbs?|pounds?).*?(?:target|goal)/i);
      if (targetWeightMatch && !client.targetWeight) {
        client.targetWeight = parseFloat(targetWeightMatch[1]);
        console.log('[IMPORT DEBUG] Found target weight:', client.targetWeight);
        continue;
      }

      // General weight detection if no specific current/target found
      const generalWeightMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:kg|lbs?|pounds?)/i);
      if (generalWeightMatch && !client.currentWeight && !client.targetWeight) {
        client.currentWeight = parseFloat(generalWeightMatch[1]);
        console.log('[IMPORT DEBUG] Found general weight:', client.currentWeight);
        continue;
      }

      // Height detection
      const heightMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:cm|ft|feet|inches?|in)/i);
      if (heightMatch && !client.height) {
        client.height = parseFloat(heightMatch[1]);
        console.log('[IMPORT DEBUG] Found height:', client.height);
        continue;
      }

      // Goals/notes detection - look for goal-related keywords or longer descriptive text
      if (!client.goals && (
        line.toLowerCase().includes('goal') || 
        line.toLowerCase().includes('note') ||
        line.toLowerCase().includes('want') ||
        line.toLowerCase().includes('improve') ||
        line.toLowerCase().includes('lose') ||
        line.toLowerCase().includes('gain') ||
        line.toLowerCase().includes('build') ||
        (line.length > 15 && !line.match(/\d+/) && !line.includes('@'))
      )) {
        client.goals = line;
        console.log('[IMPORT DEBUG] Found goals:', client.goals);
      }
    }

    console.log('[IMPORT DEBUG] Final client from block:', client);
    const result = client.firstName && client.email ? parseClientObject(client) : null;
    console.log('[IMPORT DEBUG] parseClientObject result:', result);
    return result;
  };

  const parseNumber = (value: any): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const num = parseFloat(String(value));
    return isNaN(num) ? undefined : num;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseTextContent(content);
      
      if (parsed.length === 0) {
        toast({
          title: "No Clients Found",
          description: "Could not parse any client data from the file. Please check the format.",
          variant: "destructive",
        });
        return;
      }

      setParsedClients(parsed);
      setSelectedClients(new Set(parsed.map((_, index) => index).filter(i => parsed[i].isValid)));
      setImportStep('review');
    };
    
    reader.readAsText(file);
  };

  const handleTextPaste = (content: string) => {
    if (!content.trim()) return;
    
    console.log('[IMPORT DEBUG] handleTextPaste called with content length:', content.length);
    const parsed = parseTextContent(content);
    console.log('[IMPORT DEBUG] Parsed result:', parsed);
    
    if (parsed.length === 0) {
      console.log('[IMPORT DEBUG] No clients parsed, showing error');
      toast({
        title: "No Clients Found",
        description: "Could not parse any client data from the text. Please check the format.",
        variant: "destructive",
      });
      return;
    }

    console.log('[IMPORT DEBUG] Setting parsed clients and moving to review');
    setParsedClients(parsed);
    setSelectedClients(new Set(parsed.map((_, index) => index).filter(i => parsed[i].isValid)));
    setImportStep('review');
  };

  const toggleClientSelection = (index: number) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedClients(newSelected);
  };

  const handleImport = () => {
    const clientsToImport = parsedClients.filter((_, index) => selectedClients.has(index));
    setImportStep('importing');
    importMutation.mutate(clientsToImport);
  };

  const handleClose = () => {
    setIsOpen(false);
    setImportStep('upload');
    setParsedClients([]);
    setSelectedClients(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-thrst-accent/20 hover:bg-thrst-accent/10">
          <Upload className="h-4 w-4 mr-2" />
          Import from Samsung Notes
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-morphism border-white/10 max-w-[95vw] sm:max-w-4xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto mx-2 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Import Clients from Samsung Notes
          </DialogTitle>
          <DialogDescription>
            Import your existing client data from Samsung Notes exports (text files, CSV, or JSON)
          </DialogDescription>
        </DialogHeader>

        {importStep === 'upload' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Upload File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.json"
                    onChange={handleFileUpload}
                    className="mb-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports .txt, .csv, and .json files
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Paste Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Paste your client data here..."
                    className="min-h-[80px] sm:min-h-[100px] text-sm"
                    onChange={(e) => handleTextPaste(e.target.value)}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Supported Formats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div><strong>Structured Text:</strong> Name, email, weight, goals separated by lines or blocks</div>
                <div><strong>CSV:</strong> firstName,lastName,email,currentWeight,targetWeight,goals</div>
                <div><strong>JSON:</strong> Array of client objects with standard fields</div>
                <div><strong>Samsung Notes:</strong> Exported text with client information blocks</div>
              </CardContent>
            </Card>
          </div>
        )}

        {importStep === 'review' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Import Clients from Samsung Notes</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a file or paste your client data to import multiple clients at once
              </p>
              
              {/* Format Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                <h4 className="font-semibold text-blue-900 mb-2">📋 Paste Format Examples:</h4>
                <div className="text-sm text-blue-800 space-y-2">
                  <div className="bg-white p-2 rounded border">
                    <strong>Simple Format:</strong><br/>
                    <code className="text-xs block whitespace-pre-line">
John Smith
john@email.com
85kg current weight
Goal: 80kg

Sarah Johnson
sarah@gmail.com
Current: 70kg
Target: 65kg
Goals: Build muscle and lose fat
                    </code>
                  </div>
                  <div className="text-xs text-blue-600">
                    ✅ Each client separated by blank line<br/>
                    ✅ Name on first line<br/>
                    ✅ Email anywhere<br/>
                    ✅ Weights with "kg", "lbs", "current", "target", "goal"<br/>
                    ✅ Goals/notes as longer text
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">Review Parsed Clients ({parsedClients.length})</h3>
                <p className="text-sm text-muted-foreground">
                  Select clients to import. Invalid entries are highlighted.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedClients(new Set(parsedClients.map((_, i) => i).filter(i => parsedClients[i].isValid)))}
                  className="text-xs sm:text-sm"
                >
                  Select All Valid
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedClients(new Set())}
                  className="text-xs sm:text-sm"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {parsedClients.map((client, index) => (
                <Card
                  key={index}
                  className={`cursor-pointer transition-colors ${
                    selectedClients.has(index) ? 'ring-2 ring-thrst-accent' : ''
                  } ${!client.isValid ? 'border-red-500/50 bg-red-500/5' : ''}`}
                  onClick={() => client.isValid && toggleClientSelection(index)}
                >
                  <CardContent className="p-3">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {client.firstName} {client.lastName}
                          </span>
                          {client.isValid ? (
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate mb-1">
                          {client.email}
                        </div>
                        {(client.currentWeight || client.targetWeight) && (
                          <div className="text-xs text-muted-foreground mb-1">
                            {client.currentWeight && `Current: ${client.currentWeight}kg`}
                            {client.currentWeight && client.targetWeight && ' • '}
                            {client.targetWeight && `Target: ${client.targetWeight}kg`}
                          </div>
                        )}
                        {client.goals && (
                          <div className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            Goals: {client.goals}
                          </div>
                        )}
                        {!client.isValid && (
                          <div className="flex flex-wrap gap-1">
                            {client.errors.map((error, i) => (
                              <Badge key={i} variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {error}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {client.isValid && (
                        <input
                          type="checkbox"
                          checked={selectedClients.has(index)}
                          onChange={() => toggleClientSelection(index)}
                          className="mt-1 flex-shrink-0"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setImportStep('upload')}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedClients.size === 0}
                className="bg-thrst-accent hover:bg-thrst-accent/90"
              >
                Import {selectedClients.size} Clients
              </Button>
            </div>
          </div>
        )}

        {importStep === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-thrst-accent mb-4"></div>
            <p className="text-muted-foreground">Importing clients...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
