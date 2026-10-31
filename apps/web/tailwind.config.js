/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Editorial storefront palette (mirrors --editorial-* tokens in styles/storefront.css).
        // Registered so pages can use `text-editorial-charcoal` etc. instead of inline
        // arbitrary hexes like `text-[#1b1a16]`; migrate the ~1500 inline hexes to these.
        editorial: {
          ivory: "#f7f1e5",
          paper: "#fffaf0",
          stone: "#e5decf",
          charcoal: "#1b1a16",
          muted: "#6f695f",
          brass: "#b08b4f",
          "brass-text": "#8a6a35",
        },
        // "Naskah Gelap" storefront (redesign 2026-10-31). Contrast on ink, measured: bone 15.7, sand 12.7,
        // dust 9.0, ash 6.4, faint 5.4, ember 4.9 — all clear 4.5:1 for small text.
        ng: {
          ink: "#0E0C0A",
          deep: "#110F0C",
          card: "#161310",
          bone: "#EDE6D6",
          sand: "#D8D0BF",
          dust: "#B8AF9E",
          ash: "#9B9282",
          faint: "#8F8676",
          ember: "#D4573A",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        // ng- prefixed so the Studio's existing font-mono is left alone.
        "ng-display": ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        "ng-body": ['Inter', 'system-ui', 'sans-serif'],
        "ng-mono": ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        "ng-java": ['"Noto Sans Javanese"', 'serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
