// Bastion Protocol — progress persistence via localStorage.

const SAVE_KEY = "bastion-protocol:save:v1";

export interface SaveData {
  /** Highest Stronghold index the player has cleared (-1 = none). */
  highestCleared: number;
  /** Strongholds the player has unlocked access to (index 0 always unlocked). */
  unlockedStrongholds: number;
}

const DEFAULT_SAVE: SaveData = {
  highestCleared: -1,
  unlockedStrongholds: 1,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      highestCleared: parsed.highestCleared ?? DEFAULT_SAVE.highestCleared,
      unlockedStrongholds: parsed.unlockedStrongholds ?? DEFAULT_SAVE.unlockedStrongholds,
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function saveProgress(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode / disabled) — progress simply won't persist.
  }
}

/** Record a Stronghold clear, unlocking the next one. Returns the updated save. */
export function recordClear(strongholdIndex: number, totalStrongholds: number): SaveData {
  const save = loadSave();
  save.highestCleared = Math.max(save.highestCleared, strongholdIndex);
  save.unlockedStrongholds = Math.min(
    totalStrongholds,
    Math.max(save.unlockedStrongholds, strongholdIndex + 2),
  );
  saveProgress(save);
  return save;
}

export function resetProgress(): void {
  saveProgress({ ...DEFAULT_SAVE });
}
