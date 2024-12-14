// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.html",
    "./.storybook/**/*.{js,jsx,ts,tsx}",
    "./src/stories/**/*.{js,jsx,ts,tsx}"
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        primaryBg: 'rgba(0, 8, 15, 1.000)',
        cardBg: 'rgba(3, 13, 25, 1.000)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(86, 119, 153, 1.000)',
        accentBoarder: 'rgba(17, 41, 67, 1.000)',
        accentBlue: '#5993F6',
        ramChartColor: 'rgba(246, 89, 33, 1.000)',
        cpuChartColor: 'rgba(106, 167, 248, 1.000)',
        selectedColor: 'rgba(106, 167, 248, 1.000)',
        selectedTextColor: 'rgba(1, 8, 14, 1.000)',
        buttonColor: 'rgba(4, 28, 47, 1.000)',
        buttonBorder: 'rgba(21, 39, 67, 1.000)',
        buttonHoverColor: 'rgba(4, 30, 51, 1.000)',
        buttonTextColor: 'rgba(208, 219, 229, 1.000)',
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
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0, 0, 0, 0.5)',
        hard: '0 8px 16px rgba(0, 0, 0, 0.75)',
      },
      borderRadius: {
        card: '12px',
        md: '6px',
        lg: "var(--radius)",
        sm: "calc(var(--radius) - 4px)",
      },
      borderWidth: {
        '1': '1px',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    require('tailwindcss-filters'),
    require("tailwindcss-animate")
  ],
}


