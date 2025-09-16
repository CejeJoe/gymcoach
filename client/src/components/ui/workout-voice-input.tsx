import React, { useState, useEffect, useRef } from 'react';
import { Button } from './button';
import { Mic, MicOff, Volume2, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkoutVoiceInputProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
  isActive?: boolean;
  onActiveChange?: (active: boolean) => void;
}

// Define types for Speech Recognition API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

export function WorkoutVoiceInput({ 
  onResult, 
  onError, 
  className, 
  disabled, 
  isActive = false,
  onActiveChange 
}: WorkoutVoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      setIsSupported(true);
      const recognition = new SpeechRecognitionClass() as SpeechRecognition;
      
      // Configure for continuous workout logging
      recognition.continuous = true;  // Keep listening continuously
      recognition.interimResults = true;  // Show interim results
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        onActiveChange?.(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let currentInterimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            currentInterimTranscript += transcript;
          }
        }

        setInterimTranscript(currentInterimTranscript);
        
        if (finalTranscript.trim()) {
          setTranscript(prev => prev + ' ' + finalTranscript);
          onResult(finalTranscript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.log('Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          // Automatically restart on no-speech
          setTimeout(() => {
            if (isListening) {
              try {
                recognition.start();
              } catch (e) {
                console.log('Failed to restart recognition:', e);
                setIsListening(false);
              }
            }
          }, 1000);
        } else if (event.error === 'network') {
          console.log('Network error in speech recognition - will retry in 3 seconds');
          // Retry network errors with exponential backoff
          setTimeout(() => {
            if (isListening) {
              try {
                recognition.start();
              } catch (e) {
                console.log('Failed to restart after network error:', e);
                setIsListening(false);
                onError?.('Network error - please check your connection and try again');
              }
            }
          }, 3000);
        } else if (event.error === 'aborted') {
          // Don't restart on aborted - user likely stopped intentionally
          setIsListening(false);
        } else {
          console.log('Other speech recognition error:', event.error);
          setIsListening(false);
          onError?.(event.error);
        }
      };

      recognition.onend = () => {
        // If we're supposed to be active, restart recognition
        if (isActive && !disabled) {
          restartRecognition();
        } else {
          setIsListening(false);
          onActiveChange?.(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [onResult, onError, isActive, disabled, onActiveChange]);

  // Effect to handle isActive prop changes
  useEffect(() => {
    if (isActive && !isListening && !disabled) {
      startListening();
    } else if (!isActive && isListening) {
      stopListening();
    }
  }, [isActive, disabled]);

  const restartRecognition = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    restartTimeoutRef.current = setTimeout(() => {
      if (isActive && recognitionRef.current && !disabled) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.log('Error restarting recognition:', error);
        }
      }
    }, 100); // Small delay before restarting
  };

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'no-speech':
        return 'No speech detected. Continuing to listen...';
      case 'audio-capture':
        return 'Microphone not accessible. Please check permissions.';
      case 'not-allowed':
        return 'Microphone access denied. Please allow microphone access.';
      case 'network':
        return 'Network error occurred. Please check your connection.';
      default:
        return 'Speech recognition error. Please try again.';
    }
  };

  const startListening = () => {
    if (!recognitionRef.current || isListening || disabled) return;
    
    setTranscript('');
    setInterimTranscript('');
    try {
      recognitionRef.current.start();
    } catch (error) {
      onError?.('Failed to start speech recognition');
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    recognitionRef.current.stop();
    setIsListening(false);
    onActiveChange?.(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-lg" role="alert" aria-live="assertive">
        Voice input not supported in this browser. Please use Chrome, Edge, or Safari.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant={isListening ? "destructive" : "default"}
          size="lg"
          onClick={toggleListening}
          disabled={disabled}
          className="flex items-center gap-2 min-w-[120px]"
          aria-pressed={isListening}
          aria-label={isListening ? 'Stop voice logging' : 'Start voice logging'}
        >
          {isListening ? (
            <>
              <Square className="h-5 w-5" />
              Stop Logging
            </>
          ) : (
            <>
              <Mic className="h-5 w-5" />
              Start Logging
            </>
          )}
        </Button>
        
        {isListening && (
          <div className="flex items-center gap-2 text-sm text-green-600" role="status" aria-live="polite">
            <Volume2 className="h-4 w-4 animate-pulse" />
            <span>Listening for workout updates...</span>
          </div>
        )}
      </div>
      
      {/* Live transcript display */}
      {(transcript || interimTranscript) && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2" role="status" aria-live="polite">
          {transcript && (
            <div className="text-sm">
              <span className="font-medium text-green-600">Logged: </span>
              <span>{transcript}</span>
            </div>
          )}
          {interimTranscript && (
            <div className="text-sm text-muted-foreground italic">
              <span className="font-medium">Listening: </span>
              <span>{interimTranscript}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Extend the Window interface to include speech recognition
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}
