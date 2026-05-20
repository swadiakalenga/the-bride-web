// TheBride Design System — color tokens derived from the logo palette.
// Import and use these in JS contexts (e.g., inline styles, canvas, chart configs).
// In Tailwind classes, use the `brand-`, `crimson-`, and `accent-` scale names
// which are registered in app/globals.css via @theme.

export const brand = {
  50:  "#fff7ed",
  100: "#ffedd5",
  200: "#fcd3a0",
  300: "#fba86a",
  400: "#f97c33",
  500: "#ff9800", // primary — logo outer ring orange
  600: "#ff6a00", // deep orange — main action color
  700: "#c2410c",
  800: "#9a3412",
  900: "#7c2d12",
  950: "#431407",
} as const;

export const crimson = {
  50:  "#fff1f2",
  100: "#ffe4e6",
  500: "#d72638", // logo red accent
  600: "#b91c1c",
  700: "#991b1b",
} as const;

export const accent = {
  50:  "#f5f3ff",
  100: "#ede9fe",
  500: "#6a00ff", // logo purple
  600: "#5800cc",
  700: "#4400a0",
} as const;

export const gold = "#ffcc00"; // logo gold highlight

// Gradient presets
export const gradients = {
  brand:       `linear-gradient(135deg, ${brand[500]} 0%, ${brand[600]} 100%)`,
  brandRich:   `linear-gradient(135deg, ${brand[400]} 0%, ${brand[600]} 60%, ${crimson[500]} 100%)`,
  logoOrb:     `linear-gradient(135deg, ${gold} 0%, ${brand[500]} 40%, ${brand[600]} 70%, ${crimson[500]} 100%)`,
  accentFade:  `linear-gradient(135deg, ${brand[600]} 0%, ${accent[500]} 100%)`,
} as const;

// Tailwind class shorthands for common patterns
export const tw = {
  btnPrimary:    "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60",
  btnSecondary:  "bg-brand-50 text-brand-600 hover:bg-brand-100",
  btnOutline:    "border border-brand-200 text-brand-600 hover:bg-brand-50",
  inputFocus:    "focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
  spinner:       "border-brand-500 border-t-transparent",
  badgePrimary:  "bg-brand-100 text-brand-700",
  navActive:     "text-brand-500",
  tabActive:     "border-b-2 border-brand-500 text-brand-600",
} as const;
