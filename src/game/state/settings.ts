// Bastion Protocol — user settings (audio volumes + VFX toggle), persisted.

const KEY = "bastion-protocol:settings:v1";

export interface Settings {
  master: number; // 0..1
  music: number; // 0..1
  sfx: number; // 0..1
  /** When true, skip screen shake, full-screen washes, and reduce particle counts. */
  reduceVfx: boolean;
}

const DEFAULTS: Settings = { master: 0.8, music: 0.6, sfx: 0.8, reduceVfx: false };

// Live, shared settings object. Mutated in place so references stay valid.
export const settings: Settings = load();

type Listener = (s: Settings) => void;
const listeners = new Set<Listener>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      master: clamp01(p.master ?? DEFAULTS.master),
      music: clamp01(p.music ?? DEFAULTS.music),
      sfx: clamp01(p.sfx ?? DEFAULTS.sfx),
      reduceVfx: p.reduceVfx ?? DEFAULTS.reduceVfx,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore storage failures
  }
  for (const l of listeners) l(settings);
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  if (patch.master !== undefined) settings.master = clamp01(settings.master);
  if (patch.music !== undefined) settings.music = clamp01(settings.music);
  if (patch.sfx !== undefined) settings.sfx = clamp01(settings.sfx);
  saveSettings();
}

export function onSettingsChange(fn: Listener): void {
  listeners.add(fn);
}
