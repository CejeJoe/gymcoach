import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

interface WorkoutVoiceInputProps {
  onResult: (text: string) => void;
  onError: (error: string) => void;
  isActive: boolean;
}

// Check for SpeechRecognition API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

export function WorkoutVoiceInput({ onResult, onError, isActive }: WorkoutVoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isSpeechRecognitionSupported) {
      onError('Voice recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      onResult(text.trim());
    };

    recognition.onerror = (event: any) => {
      onError(`Voice recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) {
        // Restart recognition if it stops unexpectedly
        recognition.start();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onResult, onError]);

  useEffect(() => {
    if (isActive && !isListening) {
      handleToggleListen();
    } else if (!isActive && isListening) {
      handleToggleListen();
    }
  }, [isActive]);

  const handleToggleListen = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        onError('Could not start voice recognition. Please check microphone permissions.');
      }
    }
  };

  if (!isSpeechRecognitionSupported) {
    return (
      <div className="flex items-center justify-center p-4 bg-destructive/10 text-destructive rounded-lg">
        <AlertCircle className="h-5 w-5 mr-2" />
        <p className="text-sm">Voice input is not supported by your browser.</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <p className="text-muted-foreground">
        {isListening ? 'Listening... Speak your exercise.' : 'Click the mic to start logging with your voice.'}
      </p>
      <Button 
        onClick={handleToggleListen} 
        size="lg" 
        className={`rounded-full h-20 w-20 ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-thrst-accent hover:bg-thrst-accent/90'}`}
      >
        {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
      </Button>
    </div>
  );
}
