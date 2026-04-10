

import { IconLoader2, IconMicrophone, IconRadio, IconArrowBack } from '@tabler/icons-react';

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
      case 'idle': return 'bg-[#251a3d]';
      case 'listening_wake': return 'bg-[#5b21b6]';
      case 'listening_command': return 'bg-[#742fe6]';
      case 'processing': return 'bg-amber-900/80';
      default: return 'bg-[#251a3d]';
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
    <div className={`transition-colors ${getModeColor()}`}>
      {/* Last command & confirmation */}
      {(lastCommand || lastConfirmation) && (
        <div className="px-4 py-2 bg-vilo-surface/50 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {lastCommand && (
              <p className="text-vilo-text-secondary text-xs truncate">
                Erkannt: <span className="text-[#ddd]">"{lastCommand}"</span>
              </p>
            )}
            {lastConfirmation && (
              <p className="text-[#b1d9ff] text-xs truncate mt-0.5">{lastConfirmation}</p>
            )}
          </div>
          <button
            onClick={onUndo}
            className="ml-2 p-1.5 rounded-lg bg-[#8b5cf6]/20 text-[#c4b5fd] hover:bg-[#8b5cf6]/30 transition-colors flex-shrink-0"
            title="Rückgängig"
          >
            <IconArrowBack className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Voice status bar */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        {/* Main mic button - tap to speak */}
        <button
          onClick={handleMicClick}
          className={`relative p-3 rounded-full transition-all ${
            mode === 'listening_command'
              ? 'bg-[#742fe6] text-white shadow-lg shadow-violet-500/30'
              : mode === 'listening_wake'
              ? 'bg-[#7c3aed] text-white'
              : mode === 'processing'
              ? 'bg-amber-600 text-white'
              : 'bg-[#3b245f] text-[#e9ddff] hover:bg-[#4c2f79]'
          }`}
        >
          {mode === 'listening_command' && (
            <span className="absolute inset-0 rounded-full bg-violet-400 animate-pulse-ring" />
          )}
          {mode === 'processing' ? (
            <IconLoader2 className="w-5 h-5 animate-spin relative z-10" />
          ) : mode === 'idle' ? (
            <IconMicrophone className="w-5 h-5 relative z-10" />
          ) : mode === 'listening_wake' ? (
            <IconMicrophone className="w-5 h-5 relative z-10" />
          ) : (
            <IconMicrophone className="w-5 h-5 relative z-10" />
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
              ? 'bg-[#742fe6] text-white'
              : 'bg-[#3b245f]/70 text-[#c4b5fd] hover:bg-[#4c2f79]'
          }`}
          title={isWakeMode ? 'Hey Vilo Modus aus' : 'Hey Vilo Modus an'}
        >
          <IconRadio className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
