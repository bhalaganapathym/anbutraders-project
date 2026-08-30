// Audio Chime & Loud High-Tone Alert Utility (Anbu Traders)
// Plays a high-pitched, piercing 3-second dual-pulse alert tone (1400Hz / 1750Hz)
// Designed specifically to be clearly audible in busy shop and warehouse environments.

let audioCtx: AudioContext | null = null;
let cachedAudioElem: HTMLAudioElement | null = null;
let lastPlayTimestamp = 0;

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
 * Plays a loud, piercing 3-second high alert tone.
 * Protected with a 4.5-second debounce cooldown to eliminate duplicate alarms.
 */
export function playNotificationChime() {
  const currentTimeMs = Date.now();
  // Prevent double-sounding when multiple events (WebSocket + Push + PostMessage) fire simultaneously
  if (currentTimeMs - lastPlayTimestamp < 4500) {
    return;
  }
  lastPlayTimestamp = currentTimeMs;

  // 1. HTML5 Audio element playback for direct hardware volume
  try {
    if (typeof window !== 'undefined') {
      if (!cachedAudioElem) {
        cachedAudioElem = new Audio('/alert-tone.wav');
        cachedAudioElem.volume = 1.0;
      }
      cachedAudioElem.currentTime = 0;
      const p = cachedAudioElem.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay policy prevented Audio element; Web Audio synthesizer below will execute
        });
      }
    }
  } catch (err) {
    // Non-critical
  }

  // 2. High-intensity Web Audio synthesizer (exact 3.0 seconds duration, 1400Hz & 1750Hz)
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const totalDuration = 3.0;
    const pulseCycle = 0.60; // 5 cycles across 3.0 seconds
    const numCycles = Math.ceil(totalDuration / pulseCycle);

    for (let c = 0; c < numCycles; c++) {
      const cycleStart = now + c * pulseCycle;
      if (cycleStart >= now + totalDuration) break;

      // Pulse 1: 1400 Hz
      createBeep(ctx, 1400, cycleStart, 0.18, 0.85);

      // Pulse 2: 1750 Hz
      createBeep(ctx, 1750, cycleStart + 0.22, 0.18, 0.90);
    }
  } catch (err) {
    console.warn('Alert tone playback notice:', err);
  }
}

function createBeep(ctx: AudioContext, freq: number, start: number, duration: number, peakGain: number) {
  try {
    const osc = ctx.createOscillator();
    const oscHarmonic = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(freq * 2, start);

    gainNode.gain.setValueAtTime(0.001, start);
    gainNode.gain.linearRampToValueAtTime(peakGain, start + 0.02);
    gainNode.gain.setValueAtTime(peakGain, start + duration - 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gainNode);
    oscHarmonic.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(start);
    oscHarmonic.start(start);

    osc.stop(start + duration);
    oscHarmonic.stop(start + duration);
  } catch {
    // Ignore beep error
  }
}

// User-gesture initializer so mobile Safari & Chrome immediately unlock full volume playback
export function initAudioOnUserInteraction() {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (!cachedAudioElem) {
      cachedAudioElem = new Audio('/alert-tone.wav');
      cachedAudioElem.volume = 1.0;
    }
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
}
