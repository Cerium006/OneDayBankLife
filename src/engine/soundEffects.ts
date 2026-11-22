/**
 * Аудиоменеджер игры «БанкЧар».
 * Проигрывает загруженные .mp3 звуки действий, озвучку реплик и фон серверной,
 * а также использует мягкий встроенный Web Audio API как резервный отклик.
 * Всё управление звуком завязано на переключатель игрока с сохранением в localStorage.
 */

export type SoundEffectKind =
  | 'click'
  | 'pickup'
  | 'move'
  | 'locked'
  | 'success'
  | 'alert'
  | 'paper'
  | 'keyboard'
  | 'door'
  | 'woodenDoor'
  | 'usb'
  | 'badgeReader'
  | 'sms';

const SOUND_KEY = 'bank_day_sim_sound_v1';

interface SfxAssetSpec {
  url: string;
  volume: number;
  maxDurationMs?: number;
}

const SFX_ASSETS: Partial<Record<SoundEffectKind, SfxAssetSpec>> = {
  move: {
    url: '/media/sfx/footsteps.mp3',
    volume: 0.34,
    maxDurationMs: 1350,
  },
  locked: {
    url: '/media/sfx/door_close.mp3',
    volume: 0.45,
    maxDurationMs: 1200,
  },
  paper: {
    url: '/media/sfx/paper.mp3',
    volume: 0.48,
    maxDurationMs: 1400,
  },
  keyboard: {
    url: '/media/sfx/keyboard.mp3',
    volume: 0.38,
    maxDurationMs: 1500,
  },
  door: {
    url: '/media/sfx/door_open.mp3',
    volume: 0.45,
    maxDurationMs: 1600,
  },
  woodenDoor: {
    url: '/media/sfx/wooden_door.mp3',
    volume: 0.45,
    maxDurationMs: 1500,
  },
  usb: {
    url: '/media/sfx/usb.mp3',
    volume: 0.52,
  },
  badgeReader: {
    url: '/media/sfx/badge_reader.mp3',
    volume: 0.48,
    maxDurationMs: 2200,
  },
  sms: {
    url: '/media/sfx/sms.mp3',
    volume: 0.48,
  },
};

let sharedAudioCtx: AudioContext | null = null;
let activeVoiceAudio: HTMLAudioElement | null = null;
let activeVoiceUrl: string | null = null;
let activeAmbientAudio: HTMLAudioElement | null = null;
let activeAmbientUrl: string | null = null;

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

function playSynthFallback(kind: SoundEffectKind): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    switch (kind) {
      case 'click':
      case 'keyboard':
      case 'paper':
        scheduleTone(ctx, 520, 0, 0.055, 'sine', 0.03);
        break;
      case 'move':
      case 'door':
      case 'woodenDoor':
        scheduleTone(ctx, 320, 0, 0.08, 'triangle', 0.035);
        scheduleTone(ctx, 410, 0.045, 0.09, 'triangle', 0.03);
        break;
      case 'pickup':
      case 'usb':
      case 'badgeReader':
        scheduleTone(ctx, 587.33, 0, 0.09, 'sine', 0.045);
        scheduleTone(ctx, 880, 0.065, 0.14, 'sine', 0.04);
        break;
      case 'locked':
        scheduleTone(ctx, 210, 0, 0.08, 'triangle', 0.045);
        scheduleTone(ctx, 165, 0.075, 0.11, 'triangle', 0.04);
        break;
      case 'success':
      case 'sms':
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

const activeSfxSet = new Set<HTMLAudioElement>();
const MAX_CONCURRENT_SFX = 4;

export function playSoundEffect(kind: SoundEffectKind | string, enabled: boolean): void {
  if (!enabled) {
    return;
  }

  const typedKind = kind as SoundEffectKind;
  const spec = SFX_ASSETS[typedKind];

  if (spec && typeof Audio !== 'undefined') {
    try {
      if (activeSfxSet.size >= MAX_CONCURRENT_SFX) {
        const oldest = activeSfxSet.values().next().value;
        if (oldest) {
          oldest.pause();
          activeSfxSet.delete(oldest);
        }
      }

      const audio = new Audio(spec.url);
      audio.preload = 'auto';
      audio.volume = spec.volume;
      activeSfxSet.add(audio);

      let stopped = false;
      let fadeTimerId: number | undefined;
      let stopTimerId: number | undefined;

      const cleanup = () => {
        if (stopped) return;
        stopped = true;
        if (fadeTimerId !== undefined) window.clearTimeout(fadeTimerId);
        if (stopTimerId !== undefined) window.clearTimeout(stopTimerId);
        activeSfxSet.delete(audio);
      };

      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });

      if (spec.maxDurationMs && typeof window !== 'undefined') {
        const fadeStart = Math.max(150, spec.maxDurationMs - 260);
        fadeTimerId = window.setTimeout(() => {
          if (!stopped) {
            audio.volume = spec.volume * 0.45;
          }
        }, fadeStart);
        stopTimerId = window.setTimeout(() => {
          cleanup();
          audio.pause();
          audio.currentTime = 0;
        }, spec.maxDurationMs);
      }

      void audio.play().catch(() => {
        cleanup();
        playSynthFallback(typedKind);
      });
      return;
    } catch {
      // Переходим на резервный синтезатор
    }
  }

  playSynthFallback(typedKind);
}

/** Останавливает текущую озвучку реплики, чтобы голоса никогда не наслаивались */
export function stopVoiceover(): void {
  if (activeVoiceAudio) {
    try {
      activeVoiceAudio.pause();
      activeVoiceAudio.currentTime = 0;
    } catch {
      // Игнорируем
    }
    activeVoiceAudio = null;
    activeVoiceUrl = null;
  }
}

/** Запускает озвучку реплики или вывода отчёта в одном канале */
export function playVoiceover(
  url: string | undefined,
  enabled: boolean,
  onEnded?: () => void,
): boolean {
  if (!url || !enabled || typeof Audio === 'undefined') {
    stopVoiceover();
    return false;
  }

  stopVoiceover();

  try {
    const audio = new Audio(url);
    audio.volume = 0.92;
    activeVoiceAudio = audio;
    activeVoiceUrl = url;

    audio.addEventListener('ended', () => {
      if (activeVoiceAudio === audio) {
        activeVoiceAudio = null;
        activeVoiceUrl = null;
      }
      onEnded?.();
    });

    void audio.play().catch(() => {
      if (activeVoiceAudio === audio) {
        activeVoiceAudio = null;
        activeVoiceUrl = null;
      }
      onEnded?.();
    });
    return true;
  } catch {
    return false;
  }
}

export function getActiveVoiceoverUrl(): string | null {
  return activeVoiceUrl;
}

/** Включает или переключает фоновый звук комнаты (например, шум серверной) */
export function setAmbientAudio(url: string | undefined, enabled: boolean): void {
  if (!url || !enabled || typeof Audio === 'undefined') {
    if (activeAmbientAudio) {
      try {
        activeAmbientAudio.pause();
        activeAmbientAudio.currentTime = 0;
      } catch {
        // Игнорируем
      }
      activeAmbientAudio = null;
      activeAmbientUrl = null;
    }
    return;
  }

  if (activeAmbientAudio && activeAmbientUrl === url) {
    if (activeAmbientAudio.paused) {
      void activeAmbientAudio.play().catch(() => {});
    }
    return;
  }

  if (activeAmbientAudio) {
    try {
      activeAmbientAudio.pause();
      activeAmbientAudio.currentTime = 0;
    } catch {
      // Игнорируем
    }
    activeAmbientAudio = null;
    activeAmbientUrl = null;
  }

  try {
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.14;
    activeAmbientAudio = audio;
    activeAmbientUrl = url;
    void audio.play().catch(() => {
      // Если автовоспроизведение пока заблокировано — начнётся после первого клика
    });
  } catch {
    // Игнорируем
  }
}
