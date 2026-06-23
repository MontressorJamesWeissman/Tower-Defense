// Bastion Protocol — Elemental Charges.
// Pure data: no Phaser dependency so it can be unit-tested without a canvas.

export enum Charge {
  Ember = "Ember", // Fire
  Tide = "Tide", // Water
  Frost = "Frost", // Ice
  Spark = "Spark", // Electric
  Gust = "Gust", // Wind
  Stone = "Stone", // Earth
}

export const ALL_CHARGES: readonly Charge[] = [
  Charge.Ember,
  Charge.Tide,
  Charge.Frost,
  Charge.Spark,
  Charge.Gust,
  Charge.Stone,
];

export interface ChargeMeta {
  readonly charge: Charge;
  /** Hex color used for tinting projectiles, icons, and status auras. */
  readonly color: number;
  readonly cssColor: string;
  readonly theme: string;
}

export const CHARGE_META: Readonly<Record<Charge, ChargeMeta>> = {
  [Charge.Ember]: { charge: Charge.Ember, color: 0xff7a33, cssColor: "#ff7a33", theme: "Fire" },
  [Charge.Tide]: { charge: Charge.Tide, color: 0x3a8dff, cssColor: "#3a8dff", theme: "Water" },
  [Charge.Frost]: { charge: Charge.Frost, color: 0x4fe8ff, cssColor: "#4fe8ff", theme: "Ice" },
  [Charge.Spark]: { charge: Charge.Spark, color: 0xffe14f, cssColor: "#ffe14f", theme: "Electric" },
  [Charge.Gust]: { charge: Charge.Gust, color: 0x5ad17a, cssColor: "#5ad17a", theme: "Wind" },
  [Charge.Stone]: { charge: Charge.Stone, color: 0xb08850, cssColor: "#b08850", theme: "Earth" },
};

/** How long (ms) an applied charge lingers on an enemy before decaying. */
export const CHARGE_DECAY_MS = 4000;
