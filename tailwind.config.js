// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.html"
  ],
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
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0, 0, 0, 0.5)',
        hard: '0 8px 16px rgba(0, 0, 0, 0.75)',
      },
      borderRadius: {
        card: '12px',
        md: '6px',
      },
      borderWidth: {
        '1': '1px',
      }
    },
  },
  plugins: [
    require('tailwindcss-filters'),
  ],
}


