// Bastion Protocol — Economy.
// Pure math for Cogs (currency) and the Support Ability "Surge" gauge.
// No Phaser dependency.

export interface EconomyState {
  cogs: number;
  /** Surge gauge value in [0, surgeMax]; feeds Support Abilities. */
  surge: number;
  readonly surgeMax: number;
}

export function createEconomy(startingCogs: number, surgeMax = 100): EconomyState {
  return { cogs: startingCogs, surge: 0, surgeMax };
}

export function canAfford(state: EconomyState, cost: number): boolean {
  return state.cogs >= cost;
}

/**
 * Attempt to spend cogs. Returns true and deducts if affordable; otherwise
 * returns false and leaves state unchanged.
 */
export function spend(state: EconomyState, cost: number): boolean {
  if (!canAfford(state, cost)) return false;
  state.cogs -= cost;
  return true;
}

export function addCogs(state: EconomyState, amount: number): void {
  state.cogs += Math.max(0, Math.round(amount));
}

export function addSurge(state: EconomyState, amount: number): void {
  state.surge = Math.min(state.surgeMax, state.surge + Math.max(0, amount));
}

/**
 * Reward for defeating an enemy.
 *
 * @param baseValue       enemy's base Cog value
 * @param cogMultiplier   multiplier from Collector Devices in Cog Mode (1 = none)
 * @param surgeMultiplier multiplier from Collector Devices in Surge Mode (1 = none)
 */
export interface KillReward {
  cogs: number;
  surge: number;
}

export function killReward(
  baseValue: number,
  cogMultiplier = 1,
  surgeMultiplier = 1,
): KillReward {
  return {
    cogs: Math.round(baseValue * cogMultiplier),
    // Base surge contribution per kill is a fraction of the cog value.
    surge: Math.round(baseValue * 0.5 * surgeMultiplier),
  };
}

/** Refund value when selling a device (fraction of total invested cost). */
export const SELL_REFUND_RATE = 0.6;

export function sellRefund(totalInvested: number): number {
  return Math.floor(totalInvested * SELL_REFUND_RATE);
}
