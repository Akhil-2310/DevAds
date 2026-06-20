import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#08090c",
          soft: "#0d0f14",
          panel: "#111319",
          elevated: "#161922",
        },
        line: "#21242e",
        brand: {
          DEFAULT: "#cc6b3d",
          soft: "#e08a5b",
          muted: "#6b4a36",
        },
        accent: {
          DEFAULT: "#7c8cff",
          soft: "#9aa6ff",
        },
        success: "#3fb950",
        warn: "#d29922",
        danger: "#f85149",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(124,140,255,0.35)" },
          "70%": { boxShadow: "0 0 0 10px rgba(124,140,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(124,140,255,0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        shimmer: "shimmer 1.5s infinite",
        "pulse-ring": "pulse-ring 1.8s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
