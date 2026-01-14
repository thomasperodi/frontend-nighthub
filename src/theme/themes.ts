export const dark = {
  mode: "dark" as const,
  colors: {
    background: "#0B0B0B",
    surface: "#0F0F13",
    text: "#FFFFFF",
    muted: "#C9B8FF",
    primary: "#9B5CFF",
    accent: "#47C74D",
    card: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.04)",
    error: "#FF7A7A",
    gradient: ["#1F1235", "#0B0B0B"],
  },
};

export const light = {
  mode: "light" as const,
  colors: {
    background: "#F7F7FB",
    surface: "#FFFFFF",
    text: "#0B0B0B",
    muted: "#6E5BE6",
    primary: "#6E5BE6",
    accent: "#0C8C44",
    card: "rgba(12,12,12,0.03)",
    border: "rgba(12,12,12,0.06)",
    error: "#D64545",
    gradient: ["#FFFFFF", "#F3F4F8"],
  },
};

export type Theme = typeof dark | typeof light;
