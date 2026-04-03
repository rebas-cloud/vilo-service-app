// Haptic vibration + short audio feedback for POS actions
// Uses Web Audio API (works on iOS Safari) and Vibration API

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Resume if suspended (iOS requires user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, volume: number = 0.3, type: OscillatorType = 'sine') {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available, ignore
  }
}

function vibrate(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration not available, ignore
  }
}

// === Feedback functions ===

/** Order added successfully - short upward ding */
export function feedbackOrderAdded() {
  vibrate(50);
  playTone(880, 0.12, 0.25, 'sine'); // A5 short ding
  setTimeout(() => playTone(1175, 0.15, 0.2, 'sine'), 80); // D6 higher follow-up
}

/** Order sent to kitchen/bar - confirmation double beep */
export function feedbackOrderSent() {
  vibrate([40, 30, 40]);
  playTone(660, 0.1, 0.2, 'sine'); // E5
  setTimeout(() => playTone(880, 0.1, 0.2, 'sine'), 100); // A5
  setTimeout(() => playTone(1320, 0.18, 0.25, 'sine'), 200); // E6 - rising confirmation
}

/** Item deleted - short low tone */
export function feedbackItemDeleted() {
  vibrate(30);
  playTone(330, 0.12, 0.15, 'sine'); // E4 low
}

/** Error / command not recognized */
export function feedbackError() {
  vibrate([50, 30, 50]);
  playTone(220, 0.15, 0.2, 'square'); // A3 buzzy
}

/** Generic tap feedback - very subtle */
export function feedbackTap() {
  vibrate(15);
}

/** Initialize audio context on first user interaction (needed for iOS) */
export function initAudioContext() {
  try {
    getAudioContext();
  } catch {
    // ignore
  }
}
