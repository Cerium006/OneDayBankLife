/**
 * Лёгкий синтезатор звуковых откликов через встроенный Web Audio API браузера.
 * Не требует внешних аудиофайлов и полностью работает офлайн.
 * Поддерживает мгновенное включение/отключение звука с сохранением в localStorage.
 */

export type SoundEffectKind = 'click' | 'pickup' | 'move' | 'locked' | 'success' | 'alert';

const SOUND_KEY = 'bank_day_sim_sound_v1';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function loadSoundEnabled(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return true;
    }
    const raw = window.localStorage.getItem(SOUND_KEY);
    return raw !== '0';
  } catch {
    return true;
  }
}

export function saveSoundEnabled(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
    }
  } catch {
    // Игнорируем в приватном режиме
  }
}

function scheduleTone(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType,
  peakGain: number,
): void {
  const now = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export function playSoundEffect(kind: SoundEffectKind, enabled: boolean): void {
  if (!enabled) {
    return;
  }
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    switch (kind) {
      case 'click':
        scheduleTone(ctx, 520, 0, 0.055, 'sine', 0.032);
        break;
      case 'move':
        scheduleTone(ctx, 320, 0, 0.08, 'triangle', 0.035);
        scheduleTone(ctx, 410, 0.045, 0.09, 'triangle', 0.03);
        break;
      case 'pickup':
        scheduleTone(ctx, 587.33, 0, 0.09, 'sine', 0.045);
        scheduleTone(ctx, 880, 0.065, 0.14, 'sine', 0.04);
        break;
      case 'locked':
        scheduleTone(ctx, 210, 0, 0.08, 'triangle', 0.045);
        scheduleTone(ctx, 165, 0.075, 0.11, 'triangle', 0.04);
        break;
      case 'success':
        scheduleTone(ctx, 523.25, 0, 0.11, 'sine', 0.045);
        scheduleTone(ctx, 659.25, 0.07, 0.12, 'sine', 0.045);
        scheduleTone(ctx, 783.99, 0.14, 0.22, 'sine', 0.04);
        break;
      case 'alert':
        scheduleTone(ctx, 440, 0, 0.1, 'triangle', 0.045);
        scheduleTone(ctx, 349.23, 0.09, 0.16, 'triangle', 0.04);
        break;
    }
  } catch {
    // Тихо игнорируем, если аудиоконтекст заблокирован браузером
  }
}
