import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        kitchen: {
          bg: "#0f0e0c",
          surface: "#1a1814",
          card: "#242019",
          border: "#3d3529",
          muted: "#8a7f6e",
          text: "#f5efe6",
          accent: "#e8a54b",
          accentDim: "#b87d2e",
          warn: "#e07a4f",
          danger: "#d64545",
          success: "#6b9e6b",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};

export default config;
