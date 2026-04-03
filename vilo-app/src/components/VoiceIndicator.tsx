import { Mic, Loader2, Undo2, Radio } from 'lucide-react';

interface VoiceIndicatorProps {
  mode: string;
  transcript: string;
  lastCommand: string;
  lastConfirmation: string;
  isSupported: boolean;
  isWakeMode: boolean;
  onTapSpeak: () => void;
  onToggleWake: () => void;
  onStop: () => void;
  onUndo: () => void;
}

export function VoiceIndicator({
  mode,
  transcript,
  lastCommand,
  lastConfirmation,
  isSupported,
  isWakeMode,
  onTapSpeak,
  onToggleWake,
  onStop,
  onUndo,
}: VoiceIndicatorProps) {
  if (!isSupported) {
    return (
      <div className="bg-red-900/50 border-t border-red-800 px-4 py-3">
        <p className="text-red-300 text-sm text-center">
          Spracherkennung wird von diesem Browser nicht unterstützt.
        </p>
      </div>
    );
  }

  const getModeLabel = () => {
    switch (mode) {
      case 'idle': return 'Tippe zum Sprechen';
      case 'listening_wake': return 'Sage "Hey Vilo"...';
      case 'listening_command': return 'Ich höre zu...';
      case 'processing': return 'Verarbeite...';
      default: return '';
    }
  };

  const getModeColor = () => {
    switch (mode) {
      case 'idle': return 'bg-[#2a2a42]';
      case 'listening_wake': return 'bg-violet-900/80';
      case 'listening_command': return 'bg-[#7bb7ef]';
      case 'processing': return 'bg-amber-900/80';
      default: return 'bg-[#2a2a42]';
    }
  };

  const handleMicClick = () => {
    if (mode === 'idle') {
      onTapSpeak();
    } else if (mode === 'listening_wake') {
      onTapSpeak();
    } else {
      onStop();
    }
  };

  return (
    <div className={`border-t border-[#333355] transition-colors ${getModeColor()}`}>
      {/* Last command & confirmation */}
      {(lastCommand || lastConfirmation) && (
        <div className="px-4 py-2 bg-[#2a2a42]/50 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {lastCommand && (
              <p className="text-[#b0b0cc] text-xs truncate">
                Erkannt: <span className="text-[#ddd]">"{lastCommand}"</span>
              </p>
            )}
            {lastConfirmation && (
              <p className="text-[#b1d9ff] text-xs truncate mt-0.5">{lastConfirmation}</p>
            )}
          </div>
          <button
            onClick={onUndo}
            className="ml-2 p-1.5 rounded-lg bg-[#353558]/80 text-[#c0c0dd] hover:bg-[#555] transition-colors flex-shrink-0"
            title="Rückgängig"
          >
            <Undo2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Voice status bar */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {/* Main mic button - tap to speak */}
        <button
          onClick={handleMicClick}
          className={`relative p-3 rounded-full transition-all ${
            mode === 'listening_command'
              ? 'bg-[#7bb7ef] text-white shadow-lg shadow-violet-500/30'
              : mode === 'listening_wake'
              ? 'bg-violet-700 text-white'
              : mode === 'processing'
              ? 'bg-amber-600 text-white'
              : 'bg-[#555] text-[#c0c0dd] hover:bg-slate-500'
          }`}
        >
          {mode === 'listening_command' && (
            <span className="absolute inset-0 rounded-full bg-violet-400 animate-pulse-ring" />
          )}
          {mode === 'processing' ? (
            <Loader2 className="w-5 h-5 animate-spin relative z-10" />
          ) : mode === 'idle' ? (
            <Mic className="w-5 h-5 relative z-10" />
          ) : mode === 'listening_wake' ? (
            <Mic className="w-5 h-5 relative z-10" />
          ) : (
            <Mic className="w-5 h-5 relative z-10" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">{getModeLabel()}</p>
          {transcript && mode !== 'idle' && (
            <p className="text-violet-200 text-xs truncate mt-0.5">"{transcript}"</p>
          )}
        </div>

        {/* Wake mode toggle */}
        <button
          onClick={() => isWakeMode ? onStop() : onToggleWake()}
          className={`p-2 rounded-lg transition-colors ${
            isWakeMode
              ? 'bg-[#7bb7ef] text-white'
              : 'bg-[#353558] text-[#b0b0cc] hover:bg-[#555]'
          }`}
          title={isWakeMode ? 'Hey Vilo Modus aus' : 'Hey Vilo Modus an'}
        >
          <Radio className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
