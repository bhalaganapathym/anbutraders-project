// Audio Chime & Loud High-Tone Alert Utility (Anbu Traders)
// Optimized for iPhones (iOS Safari / WebKit) & Android PWA.
// Plays a high-frequency, piercing 3-second dual-pulse alert tone (1400Hz / 1750Hz).
// Features strict cooldown debounce and single-shot gesture unlocking to prevent continuous looping.

let audioCtx: AudioContext | null = null;
let cachedAudioElem: HTMLAudioElement | null = null;
let lastPlayTimestamp = 0;
let isAudioUnlocked = false;

/**
 * Returns the singleton AudioContext, supporting both standard and legacy webkitAudioContext.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/**
 * Returns the cached HTML5 Audio element.
 */
function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!cachedAudioElem) {
    cachedAudioElem = new Audio('/alert-tone.wav');
    cachedAudioElem.volume = 1.0;
    cachedAudioElem.preload = 'auto';
  }
  return cachedAudioElem;
}

/**
 * Single-shot user gesture unlocker for mobile Safari / Chrome.
 * Resumes AudioContext on the first touch or tap without playing any audio.
 * Immediately unbinds all listeners to prevent repeated execution.
 */
export function initAudioOnUserInteraction() {
  if (typeof window === 'undefined' || isAudioUnlocked) return;

  const unlock = () => {
    if (isAudioUnlocked) return;
    isAudioUnlocked = true;

    // 1. Silent Web Audio context resume
    const ctx = getAudioContext();
    if (ctx && (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted')) {
      ctx.resume().catch(() => {});
    }

    // 2. Pre-load audio element without triggering playback
    const elem = getAudioElement();
    if (elem) {
      try {
        elem.load();
      } catch {}
    }

    // 3. Remove all unlock listeners immediately so they NEVER fire again
    const events = ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'];
    events.forEach((evt) => {
      window.removeEventListener(evt, unlock);
    });
  };

  const events = ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'];
  events.forEach((evt) => {
    window.addEventListener(evt, unlock, { once: true, passive: true });
  });

  // Re-wake audio context silently when user switches back to the tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const ctx = getAudioContext();
      if (ctx && (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted')) {
        ctx.resume().catch(() => {});
      }
    }
  });

  window.addEventListener('focus', () => {
    const ctx = getAudioContext();
    if (ctx && (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted')) {
      ctx.resume().catch(() => {});
    }
  });
}

// Listen for background push postMessage from Service Worker ONCE
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_NOTIFICATION_CHIME') {
      playNotificationChime();
    }
  });
}

/**
 * Plays the loud, piercing alert chime once.
 * Protected with a strict 4.0-second cooldown to completely prevent continuous looping.
 * @param force If true, ignores cooldown (used exclusively by manual Test Sound button).
 */
export async function playNotificationChime(force: boolean = false): Promise<boolean> {
  const nowMs = Date.now();
  // Strict 4.0s debounce: block repeated triggers from WebSocket, Push, or multiple tabs
  if (!force && nowMs - lastPlayTimestamp < 4000) {
    return false;
  }
  lastPlayTimestamp = nowMs;

  // 1. Mobile sensory haptic vibration
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([350, 100, 350, 100, 350]);
    }
  } catch {}

  let playedHtml5 = false;

  // 2. Primary: HTML5 Audio element playback (/alert-tone.wav)
  try {
    const elem = getAudioElement();
    if (elem) {
      elem.currentTime = 0;
      elem.volume = 1.0;
      const playPromise = elem.play();
      if (playPromise !== undefined) {
        await playPromise;
        playedHtml5 = true;
      }
    }
  } catch {
    playedHtml5 = false;
  }

  // 3. Fallback: Only run Web Audio synthesizer if HTML5 Audio was blocked by autoplay
  if (!playedHtml5) {
    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted') {
          await ctx.resume().catch(() => {});
        }
        playSynthesizerChime(ctx);
      }
    } catch (err) {
      console.warn('Alert tone synthesizer notice:', err);
    }
  }

  return true;
}

/**
 * Schedules high-intensity dual-pulse alert tones across 3.0 seconds.
 * 5 distinct cycles of 1400Hz and 1750Hz harmonic beeps.
 */
function playSynthesizerChime(ctx: AudioContext) {
  const startBase = Math.max(ctx.currentTime, 0) + 0.05;
  const totalDuration = 3.0;
  const pulseCycle = 0.60;
  const numCycles = Math.ceil(totalDuration / pulseCycle);

  for (let c = 0; c < numCycles; c++) {
    const cycleStart = startBase + c * pulseCycle;
    if (cycleStart >= startBase + totalDuration) break;

    // Pulse 1: 1400 Hz
    createBeep(ctx, 1400, cycleStart, 0.18, 0.85);

    // Pulse 2: 1750 Hz
    createBeep(ctx, 1750, cycleStart + 0.22, 0.18, 0.90);
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

    // Smooth envelope safe for iOS WebKit
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.linearRampToValueAtTime(peakGain, start + 0.02);
    gainNode.gain.setValueAtTime(peakGain, start + duration - 0.04);
    gainNode.gain.setTargetAtTime(0.0001, start + duration - 0.04, 0.015);

    osc.connect(gainNode);
    oscHarmonic.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(start);
    oscHarmonic.start(start);

    osc.stop(start + duration + 0.05);
    oscHarmonic.stop(start + duration + 0.05);
  } catch {
    // Ignore individual beep error
  }
}

/**
 * Explicit user-triggered test of the notification chime.
 * Unlocks audio engine and plays the chime once immediately with force=true.
 */
export async function testNotificationSound(): Promise<{ success: boolean; iphoneNotice: boolean }> {
  const ctx = getAudioContext();
  if (ctx && (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted')) {
    ctx.resume().catch(() => {});
  }
  await playNotificationChime(true);
  
  // Detect if running on iPhone / iPad / iOS
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  return { success: true, iphoneNotice: isIOS };
}
