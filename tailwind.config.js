// tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './frontend/templates/**/*.html',  // Include all your HTML files in Flask templates
    './frontend/templates/data_package/**/*.html',  // Include all your HTML files in Flask templates
    './frontend/static/js/**/*.js',  // Include your JavaScript files that might have Tailwind classes
    './**/*.py'  // If your Python files contain Tailwind classes (for dynamic content)
  ],
  theme: {
    extend: {
      colors: {
        primaryBg: 'rgba(0, 8, 15, 1.000)', // Dark background
        cardBg: 'rgba(3, 13, 25, 1.000)', // Slightly lighter card background
        textPrimary: '#FFFFFF', // White text
        textSecondary: 'rgba(86, 119, 153, 1.000)', // Lighter grey for secondary text
        accentBoarder: 'rgba(17, 41, 67, 1.000)', // Border Color
        accentBlue: '##5993F6', // Button Color 
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
        soft: '0 2px 10px rgba(0, 0, 0, 0.5)', // Soft shadow for cards
        hard: '0 8px 16px rgba(0, 0, 0, 0.75)', // Harder shadow for more prominent elements
      },
      borderRadius: {
        card: '12px', // Softer border radius for cards
        md: '6px', 
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'], // Default font family
      },
      borderWidth: {
        '1': '1px', // Custom 1px border
      },
      padding: {
        'slim': '6px 12px', // Slim padding for selected items
      },
    },
  },
  plugins: [
    require('tailwindcss-filters'), // Add this line to include the filters plugin
  ],
}


