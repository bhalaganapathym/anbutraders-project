// Audio Chime & Alert Tone Utility (Anbu Traders)
// Generates a crisp, pleasant 3-tone chime (D5 -> A5 -> D6) using the Web Audio API.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a clear, distinct 3-tone chime for incoming notifications and alerts.
 */
export function playNotificationChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 3 harmonic frequencies (D5 = 587.33Hz, A5 = 880.00Hz, D6 = 1174.66Hz)
    const tones = [
      { freq: 587.33, start: now, duration: 0.12, gain: 0.35 },
      { freq: 880.00, start: now + 0.10, duration: 0.15, gain: 0.40 },
      { freq: 1174.66, start: now + 0.22, duration: 0.35, gain: 0.45 },
    ];

    tones.forEach(({ freq, start, duration, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      // Smooth attack and exponential decay
      gainNode.gain.setValueAtTime(0.001, start);
      gainNode.gain.exponentialRampToValueAtTime(gain, start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    });
  } catch (err) {
    console.warn('Audio chime playback notice:', err);
  }
}

// User-gesture initializer so mobile Safari / Chrome allow audio playback
export function initAudioOnUserInteraction() {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
      });
    } else {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    }
  };
  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
}
