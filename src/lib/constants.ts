export const PROJECT_COLORS = [
  "#4F46E5", // indigo
  "#2563EB", // blue
  "#06B6D4", // cyan
  "#14B8A6", // teal
  "#22C55E", // green
  "#84CC16", // lime
  "#EAB308", // yellow
  "#F97316", // orange
  "#EF4444", // red
  "#EC4899", // pink
  "#A855F7", // purple
  "#6B7280", // gray
];

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "\u20AC", name: "Euro" },
  { code: "GBP", symbol: "\u00A3", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "\u00A5", name: "Japanese Yen" },
];

export const DATE_PRESETS = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 30 Days", value: "last_30_days" },
  { label: "Custom", value: "custom" },
] as const;
