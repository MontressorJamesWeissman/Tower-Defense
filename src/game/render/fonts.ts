// Bastion Protocol — font families.
// Loaded via Google Fonts in index.html (with graceful fallback). Display font
// is a fantasy serif for headers; body font is a clean condensed sans for
// HUD numbers and labels.

export const FONTS = {
  display: '"Cinzel", "Times New Roman", serif',
  body: '"Rajdhani", "Segoe UI", system-ui, sans-serif',
} as const;

/** Families to actively load before the menu shows, so text renders correctly. */
export const FONT_LOAD_SPECS = ["600 1em Cinzel", "700 1em Cinzel", "600 1em Rajdhani", "700 1em Rajdhani"];
