import { useCallback, useEffect, useRef, useState } from 'react';

type VoiceMode = 'idle' | 'listening_wake' | 'listening_command' | 'processing';

// Comprehensive wake phrases - covers all common speech recognition misinterpretations
// Google/Apple Speech Recognition often mishears "Vilo" as Velo, Belo, Filo, Bilo, Wilo, Villa, etc.
const WAKE_PREFIXES = ['hey', 'hallo', 'he', 'hei', 'hi', 'ok', 'ey', 'ei', 'hay'];
const VILO_VARIANTS = [
  'vilo', 'wilo', 'filo', 'bilo', 'velo', 'belo', 'hilo', 'milo',
  'villa', 'fila', 'bila', 'vila', 'wila', 'fielo', 'vielo', 'wielo',
  'pilo', 'tilo', 'kilo', 'dilo', 'nilo', 'rilo', 'silo', 'zilo',
  'villo', 'fillo', 'billo', 'willo', 'felo', 'pelo', 'delo',
  'viro', 'firo', 'biro', 'wiro', 'ило',
  'vilow', 'filow', 'wilow', 'bilow',
  'valu', 'velo', 'feelo', 'veelo', 'weelo',
];

// Pre-compute all combinations for fast lookup
const WAKE_PHRASES: string[] = [];
for (const prefix of WAKE_PREFIXES) {
  for (const variant of VILO_VARIANTS) {
    WAKE_PHRASES.push(`${prefix} ${variant}`);
  }
}
// Also add without space (speech recognition sometimes merges words)
WAKE_PHRASES.push('hevilo', 'heyvilo', 'hallovilo', 'hivilo', 'okvilo', 'eyvilo');
// Add standalone triggers
WAKE_PHRASES.push('hey vilo', 'hallo vilo');

// Fuzzy wake detection: also match if transcript contains a word similar to "vilo"
function detectWakePhrase(transcript: string): boolean {
  const lower = transcript.toLowerCase().trim();

  // 1. Exact phrase match
  for (const phrase of WAKE_PHRASES) {
    if (lower.includes(phrase)) return true;
  }

  // 2. Fuzzy match: check if any word is close to "vilo" after a greeting word
  const words = lower.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Check if this word sounds like "vilo" (edit distance <= 2)
    if (word.length >= 3 && word.length <= 7) {
      const isGreetingBefore = i > 0 && WAKE_PREFIXES.includes(words[i - 1]);
      const isCloseToVilo = levenshtein(word, 'vilo') <= 2;
      if (isGreetingBefore && isCloseToVilo) return true;
      // Also check without greeting prefix if the word is very close
      if (levenshtein(word, 'vilo') <= 1 && i > 0) return true;
    }
  }

  return false;
}

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

interface UseVoiceReturn {
  mode: VoiceMode;
  transcript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  startDirectCommand: () => void;
  lastCommand: string;
  isWakeMode: boolean;
}

export function useVoice(onCommand: (command: string) => void): UseVoiceReturn {
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [isWakeMode, setIsWakeMode] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const modeRef = useRef<VoiceMode>('idle');
  const commandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppedRef = useRef(false);
  const onCommandRef = useRef(onCommand);
  const commandBufferRef = useRef('');
  const wakeModeRef = useRef(false);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    wakeModeRef.current = isWakeMode;
  }, [isWakeMode]);

  const getSpeechRecognition = useCallback((): SpeechRecognition | null => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    return new SR();
  }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SR);
  }, []);

  const processCommand = useCallback((command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;
    console.log('[VILO] Processing command:', trimmed);
    setLastCommand(trimmed);
    setMode('processing');
    modeRef.current = 'processing';
    onCommandRef.current(trimmed);
  }, []);

  const startRecognition = useCallback((forCommand: boolean) => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    const recognition = getSpeechRecognition();
    if (!recognition) return;

    recognition.continuous = !forCommand;
    recognition.interimResults = true;
    recognition.lang = 'de-DE';
    commandBufferRef.current = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = (finalTranscript || interimTranscript).trim();
      setTranscript(currentTranscript);
      console.log('[VILO] Transcript:', currentTranscript, 'final:', !!finalTranscript, 'forCommand:', forCommand);

      if (!forCommand) {
        // Wake phrase detection - uses fuzzy matching for all "Vilo" variants
        if (detectWakePhrase(currentTranscript)) {
          console.log('[VILO] Wake phrase detected!', currentTranscript);
          setMode('listening_command');
          modeRef.current = 'listening_command';
          setTranscript('');
          try { recognition.abort(); } catch { /* ignore */ }
          setTimeout(() => startRecognition(true), 300);
          return;
        }
      } else {
        // Command mode - process final result
        if (finalTranscript) {
          commandBufferRef.current += finalTranscript;

          if (commandTimeoutRef.current) {
            clearTimeout(commandTimeoutRef.current);
          }
          commandTimeoutRef.current = setTimeout(() => {
            const command = commandBufferRef.current.trim();
            commandBufferRef.current = '';
            if (command) {
              processCommand(command);
              // Continue listening for next command after processing
              setTimeout(() => {
                if (isStoppedRef.current) return;
                if (wakeModeRef.current) {
                  setMode('listening_wake');
                  modeRef.current = 'listening_wake';
                  setTranscript('');
                  startRecognition(false);
                } else {
                  // Keep listening in command mode (continuous)
                  setMode('listening_command');
                  modeRef.current = 'listening_command';
                  setTranscript('');
                  startRecognition(true);
                }
              }, 1500);
            }
          }, 1200);
        }
      }
    };

    recognition.onend = () => {
      if (isStoppedRef.current) return;

      if (forCommand) {
        // In command mode, process any remaining buffer
        const pending = commandBufferRef.current.trim();
        if (pending) {
          commandBufferRef.current = '';
          if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
          processCommand(pending);
          setTimeout(() => {
            if (isStoppedRef.current) return;
            if (wakeModeRef.current) {
              setMode('listening_wake');
              modeRef.current = 'listening_wake';
              setTranscript('');
              startRecognition(false);
            } else {
              // Keep listening in command mode (continuous)
              setMode('listening_command');
              modeRef.current = 'listening_command';
              setTranscript('');
              startRecognition(true);
            }
          }, 1500);
        } else if (!commandTimeoutRef.current) {
          // No result at all - keep listening
          if (isStoppedRef.current) return;
          if (wakeModeRef.current) {
            setMode('listening_wake');
            modeRef.current = 'listening_wake';
            startRecognition(false);
          } else {
            // Restart command listening
            setMode('listening_command');
            modeRef.current = 'listening_command';
            setTranscript('');
            startRecognition(true);
          }
        }
        return;
      }

      // Wake mode - auto restart
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(() => {
        if (!isStoppedRef.current && modeRef.current === 'listening_wake') {
          startRecognition(false);
        }
      }, 300);
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      console.log('[VILO] Speech error:', event.error);
      if (event.error === 'no-speech') {
        if (forCommand) {
          if (isStoppedRef.current) return;
          if (wakeModeRef.current) {
            setMode('listening_wake');
            modeRef.current = 'listening_wake';
            startRecognition(false);
          } else {
            // Keep listening in command mode (continuous)
            setMode('listening_command');
            modeRef.current = 'listening_command';
            startRecognition(true);
          }
        }
        return;
      }
      if (!isStoppedRef.current) {
        setTimeout(() => {
          if (!isStoppedRef.current) {
            startRecognition(modeRef.current === 'listening_command');
          }
        }, 1000);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      console.log('[VILO] Recognition started:', forCommand ? 'command' : 'wake');
    } catch (e) {
      console.error('[VILO] Failed to start:', e);
    }
  }, [getSpeechRecognition, processCommand]);

  // Start continuous wake-phrase mode ("Hey Vilo" listening)
  const startListening = useCallback(() => {
    isStoppedRef.current = false;
    setIsWakeMode(true);
    wakeModeRef.current = true;
    setMode('listening_wake');
    modeRef.current = 'listening_wake';
    startRecognition(false);
  }, [startRecognition]);

  // Start direct command mode (tap to speak) - continuous until stopped
  const startDirectCommand = useCallback(() => {
    isStoppedRef.current = false;
    setIsWakeMode(false);
    wakeModeRef.current = false;
    setMode('listening_command');
    modeRef.current = 'listening_command';
    setTranscript('');
    startRecognition(true);
  }, [startRecognition]);

  const stopListening = useCallback(() => {
    isStoppedRef.current = true;
    setIsWakeMode(false);
    wakeModeRef.current = false;
    if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }
    setMode('idle');
    modeRef.current = 'idle';
    setTranscript('');
    commandBufferRef.current = '';
  }, []);

  useEffect(() => {
    return () => {
      isStoppedRef.current = true;
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, []);

  return { mode, transcript, isSupported, startListening, stopListening, startDirectCommand, lastCommand, isWakeMode };
}
