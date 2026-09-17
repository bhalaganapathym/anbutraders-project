// Audio Chime & Loud High-Tone Alert Utility (Anbu Traders)
// Optimized specifically for iPhones (iOS Safari / WebKit) & Android PWA.
// Plays a piercing, high-frequency 3-second dual-pulse alert tone (1400Hz / 1750Hz)
// with multi-channel redundancy (Web Audio Synthesizer + HTML5 Audio + Haptic Vibration).

let audioCtx: AudioContext | null = null;
let cachedAudioElem: HTMLAudioElement | null = null;
let lastPlayTimestamp = 0;
let isListeningForUnlock = false;

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
 * Returns the cached HTML5 Audio element configured for iOS WebKit inline playback.
 */
function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!cachedAudioElem) {
    cachedAudioElem = new Audio('/alert-tone.wav');
    cachedAudioElem.volume = 1.0;
    cachedAudioElem.preload = 'auto';
    cachedAudioElem.playsInline = true;
    (cachedAudioElem as any).webkitPlaysInline = true;
  }
  return cachedAudioElem;
}

/**
 * Unlocks WebKit AudioContext by scheduling an inaudible 1-sample buffer within a user gesture.
 * Crucial for iOS Safari so subsequent async alerts can play without being blocked by autoplay policy.
 */
function unlockWebAudio(ctx: AudioContext) {
  if (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted') {
    ctx.resume().catch(() => {});
  }
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Ignore unlock buffer error
  }
}

/**
 * Unlocks HTML5 Audio on iOS by pre-rolling play() and pause() during a user interaction.
 */
function unlockAudioElement(elem: HTMLAudioElement) {
  try {
    const playPromise = elem.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          elem.pause();
          elem.currentTime = 0;
        })
        .catch(() => {});
    }
  } catch {
    // Ignore pre-roll error
  }
}

/**
 * Global persistent gesture listener.
 * On iOS Safari, the AudioContext is suspended when the phone locks or tab changes.
 * By keeping a lightweight passive listener on touch/click, any subsequent user interaction
 * immediately refreshes the audio session back to 'running'.
 */
export function initAudioOnUserInteraction() {
  if (typeof window === 'undefined' || isListeningForUnlock) return;
  isListeningForUnlock = true;

  const handleUserGesture = () => {
    const ctx = getAudioContext();
    if (ctx) {
      unlockWebAudio(ctx);
    }
    const elem = getAudioElement();
    if (elem) {
      unlockAudioElement(elem);
    }
  };

  // Listen on standard user gesture events passively
  const events = ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'];
  events.forEach((evt) => {
    window.addEventListener(evt, handleUserGesture, { passive: true });
  });

  // Wake up audio context when user returns to app or screen turns back on
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

  // Listen for background push postMessage from Service Worker to trigger foreground chime
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_CHIME') {
        playNotificationChime();
      }
    });
  }
}

/**
 * Plays the loud, piercing 3-second alert chime with dual-channel fallback.
 * @param force If true, ignores the 3.5-second debounce (useful for manual test button).
 */
export async function playNotificationChime(force: boolean = false): Promise<boolean> {
  const nowMs = Date.now();
  if (!force && nowMs - lastPlayTimestamp < 3500) {
    return false;
  }
  lastPlayTimestamp = nowMs;

  let played = false;

  // 1. Haptic Vibration (Physical sensory alert on mobile phones)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([350, 100, 350, 100, 350]);
    }
  } catch {}

  // 2. HTML5 Audio Element playback (direct hardware media channel)
  try {
    const elem = getAudioElement();
    if (elem) {
      elem.currentTime = 0;
      elem.volume = 1.0;
      const p = elem.play();
      if (p !== undefined) {
        p.then(() => {
          played = true;
        }).catch(() => {
          // Autoplay blocked; Web Audio synthesizer below will execute
        });
      }
    }
  } catch {}

  // 3. Web Audio Synthesizer (Loud 1400Hz & 1750Hz harmonic beeps)
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended' || (ctx.state as any) === 'interrupted') {
        await ctx.resume().catch(() => {});
      }
      playSynthesizerChime(ctx);
      played = true;
    }
  } catch (err) {
    console.warn('Alert tone synthesizer notice:', err);
  }

  return played;
}

/**
 * Schedules high-intensity dual-pulse alert tones across 3.0 seconds.
 * Uses safe linear ramp and exponential decay parameters to prevent iOS WebKit monotonic-time exceptions.
 */
function playSynthesizerChime(ctx: AudioContext) {
  const startBase = Math.max(ctx.currentTime, 0) + 0.05;
  const totalDuration = 3.0;
  const pulseCycle = 0.60; // 5 cycles across 3.0 seconds
  const numCycles = Math.ceil(totalDuration / pulseCycle);

  for (let c = 0; c < numCycles; c++) {
    const cycleStart = startBase + c * pulseCycle;
    if (cycleStart >= startBase + totalDuration) break;

    // Pulse 1: 1400 Hz (piercing shop alert)
    createBeep(ctx, 1400, cycleStart, 0.18, 0.85);

    // Pulse 2: 1750 Hz (high alert)
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
 * Unlocks and plays the chime immediately with force=true.
 */
export async function testNotificationSound(): Promise<{ success: boolean; iphoneNotice: boolean }> {
  const ctx = getAudioContext();
  if (ctx) {
    unlockWebAudio(ctx);
  }
  const elem = getAudioElement();
  if (elem) {
    unlockAudioElement(elem);
  }
  await playNotificationChime(true);
  
  // Detect if running on iPhone / iPad / iOS
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  return { success: true, iphoneNotice: isIOS };
}
