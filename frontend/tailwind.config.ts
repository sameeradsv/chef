import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        kitchen: {
          bg:       "rgb(var(--kitchen-bg)       / <alpha-value>)",
          surface:  "rgb(var(--kitchen-surface)  / <alpha-value>)",
          card:     "rgb(var(--kitchen-card)     / <alpha-value>)",
          border:   "var(--kitchen-line)",
          muted:    "rgb(var(--kitchen-ink3)     / <alpha-value>)",
          text:     "rgb(var(--kitchen-ink)      / <alpha-value>)",
          accent:   "rgb(var(--kitchen-accent)   / <alpha-value>)",
          accentDim:"rgb(var(--kitchen-accent2)  / <alpha-value>)",
          warn:     "rgb(var(--kitchen-warn)     / <alpha-value>)",
          danger:   "rgb(var(--kitchen-danger)   / <alpha-value>)",
          success:  "rgb(var(--kitchen-success)  / <alpha-value>)",
        },
      },
      fontFamily: {
        sans:    ["var(--chef-font-sans)",  "system-ui",  "sans-serif"],
        display: ["var(--chef-font-serif)", "Georgia",    "serif"],
        mono:    ["var(--chef-font-mono)",  "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "var(--radius-card)",
        btn:  "var(--radius-btn)",
      },
    },
  },
  plugins: [],
};

export default config;
