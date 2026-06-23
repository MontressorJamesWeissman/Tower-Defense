// Bastion Protocol — audio palette.
//
// All synthesis parameters live here so the sound design can be retuned without
// touching gameplay code. Charge families share an instrument so the elements
// sound coherent; cues reference these by name.

import { Charge } from "../logic/elements";

/** Which synth voice a cue is routed through. */
export type Voice = "fm" | "pluck" | "metal" | "membrane" | "noise" | "bell" | "click";

export interface CueDef {
  voice: Voice;
  /** Pitch (scientific notation) or frequency in Hz; omitted for noise voices. */
  note?: string | number;
  /** Note length, Tone time value (e.g. "16n") or seconds. */
  duration: string | number;
  velocity?: number;
}

// --- Turret fire: one timbre per Charge family --------------------------------
export const SHOTS: Readonly<Record<Charge, CueDef>> = {
  [Charge.Ember]: { voice: "fm", note: "C2", duration: "8n", velocity: 0.5 }, // warm low pluck
  [Charge.Tide]: { voice: "pluck", note: "G3", duration: "8n", velocity: 0.7 }, // soft water-drop
  [Charge.Frost]: { voice: "bell", note: "C6", duration: "16n", velocity: 0.4 }, // bell chime
  [Charge.Spark]: { voice: "metal", note: "C7", duration: "32n", velocity: 0.3 }, // sharp zap
  [Charge.Gust]: { voice: "noise", duration: "16n", velocity: 0.25 }, // airy whoosh
  [Charge.Stone]: { voice: "membrane", note: "C1", duration: "8n", velocity: 0.8 }, // low thud
};

// --- Impact: shared percussive thud, slightly varied per Charge ---------------
export const IMPACT_NOTE: Readonly<Record<Charge, string>> = {
  [Charge.Ember]: "E2",
  [Charge.Tide]: "C2",
  [Charge.Frost]: "G2",
  [Charge.Spark]: "A2",
  [Charge.Gust]: "D2",
  [Charge.Stone]: "C1",
};

// --- Reaction: a bright two-note chime; pitch pair per reaction name ----------
export const REACTION_CHORDS: Readonly<Record<string, string[]>> = {
  VaporBurst: ["C5", "G5"],
  ThawSnap: ["E5", "B5"],
  Solidify: ["C5", "Eb5"],
  ShortCircuit: ["G5", "D6"],
  Combust: ["A4", "E5"],
  Vortex: ["D5", "A5"],
  FortifyBreak: ["C4", "G4"],
  ChargeSwap: ["C5", "F5"],
};

// --- Misc one-shots -----------------------------------------------------------
export const CUES = {
  death: { voice: "fm", note: "A3", duration: "16n", velocity: 0.4 } as CueDef,
  coreDamage: { voice: "metal", note: "A2", duration: "8n", velocity: 0.6 } as CueDef,
  ability: { voice: "noise", duration: "2n", velocity: 0.5 } as CueDef,
  uiHover: { voice: "click", note: "C6", duration: "64n", velocity: 0.15 } as CueDef,
  uiClick: { voice: "click", note: "C5", duration: "64n", velocity: 0.3 } as CueDef,
  uiConfirm: { voice: "bell", note: "C6", duration: "16n", velocity: 0.4 } as CueDef,
  uiDenied: { voice: "click", note: "C3", duration: "32n", velocity: 0.4 } as CueDef,
};

/** Short arpeggiated phrases for wave start / clear. */
export const FANFARES = {
  start: ["C4", "G4", "C5"],
  clear: ["C5", "E5", "G5", "C6"],
};

// --- Music: procedural loop definitions ---------------------------------------
export interface MusicTrackDef {
  bpm: number;
  /** Chord pad notes cycled slowly. */
  pad: string[][];
  /** Arpeggio notes stepped at the subdivision. */
  arp: string[];
  arpSubdivision: string;
  /** Whether a rhythmic kick pulse plays. */
  kick: boolean;
}

export const MUSIC: Readonly<Record<"menu" | "setup" | "assault", MusicTrackDef>> = {
  menu: {
    bpm: 70,
    pad: [["C3", "G3", "Eb4"], ["Ab2", "Eb3", "C4"]],
    arp: ["C5", "Eb5", "G5", "Eb5"],
    arpSubdivision: "2n",
    kick: false,
  },
  setup: {
    bpm: 96,
    pad: [["C3", "G3", "D4"], ["F2", "C3", "A3"], ["G2", "D3", "B3"]],
    arp: ["C5", "G4", "D5", "A4"],
    arpSubdivision: "4n",
    kick: false,
  },
  assault: {
    bpm: 132,
    pad: [["C3", "G3", "Eb4"], ["Bb2", "F3", "D4"], ["Ab2", "Eb3", "C4"]],
    arp: ["C5", "Eb5", "G5", "Bb5", "G5", "Eb5"],
    arpSubdivision: "8n",
    kick: true,
  },
};
