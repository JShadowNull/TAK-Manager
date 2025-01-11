// tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.html",
	],
  theme: {
    screens: {
      'xs': '320px',
      'sm': '375px',
      'md': '393px',
      'lg': '430px',
      'xl': '834px',
      '2xl': '1024px',
      '3xl': '1032px',
    },
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			xs: '320px',
  			sm: '375px',
  			md: '393px',
  			lg: '430px',
  			xl: '834px',
  			'2xl': '1024px',
  			'3xl': '1032px'
  		}
  	},
  	extend: {
  		colors: {
  			textSecondary: 'hsl(var(--muted-foreground))',
  			accentBoarder: 'hsl(var(--border))',
  			accentBlue: 'hsl(var(--primary))',
  			ramChartColor: 'hsl(var(--chart-2))',
  			cpuChartColor: 'hsl(var(--chart-1))',
  			selectedColor: 'hsl(var(--primary))',
  			selectedTextColor: 'hsl(var(--primary-foreground))',
  			buttonColor: 'hsl(var(--secondary))',
  			buttonBorder: 'hsl(var(--border))',
  			buttonHoverColor: 'hsl(var(--accent))',
  			buttonTextColor: 'hsl(var(--secondary-foreground))',
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: 0
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: 0
  				}
  			},
        'indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' }
        }
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
        'indeterminate': 'indeterminate 1s ease-in-out infinite'
  		}
  	}
  },
  plugins: [
    require("tailwindcss-animate")
  ],
}


