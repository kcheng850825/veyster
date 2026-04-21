import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm canvas — cream with a hint of peach; nothing feels clinical.
        canvas: {
          DEFAULT: "#FFF8F1",
          100: "#FFF3E6",
          200: "#FFE8D1",
          300: "#FFD9B4",
        },
        // Primary — electric indigo/violet. Frontier-tech feel.
        brand: {
          50:  "#F0EEFF",
          100: "#E0DCFF",
          200: "#C4BDFF",
          300: "#9E92FF",
          400: "#7A66FB",
          500: "#5B47F0",
          600: "#4732DC",
          700: "#3624B5",
          800: "#281991",
          900: "#1B1172",
        },
        // Accent — warm tangerine. Use sparingly for highlights / callouts.
        accent: {
          50:  "#FFF3E9",
          100: "#FFE4CE",
          200: "#FFC59B",
          300: "#FFA56E",
          400: "#FF8B47",
          500: "#FF6F1F",
          600: "#E25405",
        },
        // Semantic swipe colors — friendlier than pure emerald/red.
        yes: {
          50:  "#E6FBF6",
          100: "#CCF6EC",
          300: "#6FE7CF",
          500: "#2FCFA9",
          600: "#1AB58E",
          700: "#138A6C",
        },
        no: {
          50:  "#FFEEF0",
          100: "#FFD9DF",
          300: "#FF97A7",
          500: "#FF5773",
          600: "#E03E5A",
          700: "#B52D45",
        },
        // Warm grayscale — stays readable on cream; less corporate than cool grays.
        ink: {
          50:  "#F9F6F2",
          100: "#EFEAE3",
          200: "#DDD5CA",
          300: "#C1B6A6",
          400: "#958872",
          500: "#665C4D",
          600: "#443D33",
          700: "#2B271F",
          800: "#1C1914",
          900: "#111014",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // Display sizes tuned for the serif headline font.
        "display-sm": ["2.5rem",   { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
        "display":    ["3.25rem",  { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-lg": ["4.5rem",   { lineHeight: "1",    letterSpacing: "-0.03em" }],
      },
      borderRadius: {
        xl:   "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
        "4xl": "2.5rem",
      },
      boxShadow: {
        // Colorful, offset — gives cards a sense of lift without feeling heavy.
        soft:    "0 10px 40px -12px rgba(91, 71, 240, 0.18)",
        pop:     "0 20px 50px -16px rgba(91, 71, 240, 0.28)",
        warm:    "0 12px 36px -14px rgba(255, 111, 31, 0.25)",
        ring:    "0 0 0 4px rgba(91, 71, 240, 0.12)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #7A66FB 0%, #5B47F0 45%, #FF6F1F 100%)",
        "brand-soft":
          "linear-gradient(180deg, #FFF8F1 0%, #F0EEFF 100%)",
        "shine":
          "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 55%)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(1)", opacity: "0.5" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "fade-up":    "fade-up 0.4s ease-out both",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
