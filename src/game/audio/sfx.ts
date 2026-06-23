// Bastion Protocol — sound-effect hooks.
//
// No audio assets ship with this build, so these are stub hook points: the
// call sites throughout the game are real, and dropping in Phaser sound (or a
// WebAudio layer) later only requires implementing `emit` below. Keeping the
// hooks in place now means the "juice" wiring is already done.

export type SfxName =
  | "place"
  | "shoot"
  | "hit"
  | "reaction"
  | "kill"
  | "breach"
  | "ability"
  | "win"
  | "lose";

let enabled = true;

export const Sfx = {
  setEnabled(value: boolean): void {
    enabled = value;
  },
  isEnabled(): boolean {
    return enabled;
  },
  /** Fire a named sound cue. No-op until an audio backend is attached. */
  play(_name: SfxName): void {
    if (!enabled) return;
    // Intentionally empty: hook point for a future audio backend.
  },
};
