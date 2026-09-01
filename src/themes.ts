export type ThemeId =
  | "zen-light"
  | "zen-dark"
  | "catppuccin-latte"
  | "catppuccin-frappe"
  | "catppuccin-macchiato"
  | "catppuccin-mocha";

export type ThemeMode = "light" | "dark";

export interface ThemeDefinition {
  id: ThemeId;
  mode: ThemeMode;
  label: string;
  nativeBackground: string;
  colors: Record<string, string>;
}

const zenLight = {
  "--paper": "#f6f3ec", "--panel": "#fbf9f3", "--panel-2": "#fffefa", "--reader": "#fbf9f3",
  "--ink": "#1a1816", "--ink-2": "#3a3733", "--muted": "#7a756c", "--muted-2": "#a8a39a",
  "--hair": "rgba(20,18,16,.08)", "--hair-strong": "rgba(20,18,16,.14)", "--hover": "rgba(20,18,16,.04)", "--selected": "rgba(20,18,16,.06)",
  "--accent": "#b8613d", "--accent-soft": "#f5e8dc", "--accent-ink": "#754027", "--native": "#fbf9f3",
};

const zenDark = {
  "--paper": "#0a0b0c", "--panel": "#131415", "--panel-2": "#19191a", "--reader": "#1d1e1f",
  "--ink": "#ebe7e4", "--ink-2": "#c9c3bd", "--muted": "#96918a", "--muted-2": "#706b66",
  "--hair": "rgba(246,240,238,.09)", "--hair-strong": "rgba(246,240,238,.15)", "--hover": "rgba(246,240,238,.05)", "--selected": "rgba(246,240,238,.07)",
  "--accent": "#da8564", "--accent-soft": "#4c3025", "--accent-ink": "#e1ad96", "--native": "#1d1e1f",
};

const catppuccin = (colors: Record<string, string>): ThemeDefinition["colors"] => ({
  ...colors,
  "--accent": colors["--accent"] ?? "#cba6f7",
  "--accent-soft": colors["--accent-soft"] ?? "#45475a",
  "--accent-ink": colors["--accent-ink"] ?? "#cba6f7",
});

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  "zen-light": { id: "zen-light", mode: "light", label: "Zen Light", nativeBackground: zenLight["--native"], colors: zenLight },
  "zen-dark": { id: "zen-dark", mode: "dark", label: "Zen Dark", nativeBackground: zenDark["--native"], colors: zenDark },
  "catppuccin-latte": { id: "catppuccin-latte", mode: "light", label: "Catppuccin Latte", nativeBackground: "#eff1f5", colors: catppuccin({
    "--paper": "#e6e9ef", "--panel": "#eff1f5", "--panel-2": "#ffffff", "--reader": "#eff1f5", "--ink": "#4c4f69", "--ink-2": "#5c5f77", "--muted": "#8c8fa1", "--muted-2": "#9ca0b0", "--hair": "rgba(76,79,105,.12)", "--hair-strong": "rgba(76,79,105,.2)", "--hover": "rgba(76,79,105,.06)", "--selected": "rgba(76,79,105,.1)", "--accent": "#8839ef", "--accent-soft": "#e6d9ff", "--accent-ink": "#6c2bc2", "--native": "#eff1f5",
  }) },
  "catppuccin-frappe": { id: "catppuccin-frappe", mode: "dark", label: "Catppuccin Frappé", nativeBackground: "#303446", colors: catppuccin({ "--paper": "#232634", "--panel": "#292c3c", "--panel-2": "#303446", "--reader": "#303446", "--ink": "#c6d0f5", "--ink-2": "#b5bfe2", "--muted": "#838ba7", "--muted-2": "#737994", "--hair": "rgba(198,208,245,.12)", "--hair-strong": "rgba(198,208,245,.2)", "--hover": "rgba(198,208,245,.07)", "--selected": "rgba(198,208,245,.11)", "--accent": "#ca9ee6", "--accent-soft": "#514463", "--accent-ink": "#ca9ee6" }) },
  "catppuccin-macchiato": { id: "catppuccin-macchiato", mode: "dark", label: "Catppuccin Macchiato", nativeBackground: "#24273a", colors: catppuccin({ "--paper": "#181926", "--panel": "#1e2030", "--panel-2": "#24273a", "--reader": "#24273a", "--ink": "#cad3f5", "--ink-2": "#b8c0e0", "--muted": "#8087a2", "--muted-2": "#6e738d", "--hair": "rgba(202,211,245,.12)", "--hair-strong": "rgba(202,211,245,.2)", "--hover": "rgba(202,211,245,.07)", "--selected": "rgba(202,211,245,.11)", "--accent": "#c6a0f6", "--accent-soft": "#504165", "--accent-ink": "#c6a0f6" }) },
  "catppuccin-mocha": { id: "catppuccin-mocha", mode: "dark", label: "Catppuccin Mocha", nativeBackground: "#1e1e2e", colors: catppuccin({ "--paper": "#11111b", "--panel": "#181825", "--panel-2": "#1e1e2e", "--reader": "#1e1e2e", "--ink": "#cdd6f4", "--ink-2": "#bac2de", "--muted": "#7f849c", "--muted-2": "#6c7086", "--hair": "rgba(205,214,244,.12)", "--hair-strong": "rgba(205,214,244,.2)", "--hover": "rgba(205,214,244,.07)", "--selected": "rgba(205,214,244,.11)", "--accent": "#cba6f7", "--accent-soft": "#4b3b61", "--accent-ink": "#cba6f7" }) },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
