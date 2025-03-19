import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

// Theme color values from tailwind.css
const THEME_COLORS = {
  light: "hsl(0 0% 100%)",
  dark: "hsl(240 10% 3.9%)"
}

// Helper to get the actual theme (accounting for system preference)
export function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  }
  return theme
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement
    const themeColorMeta = document.querySelector('meta[name="theme-color"]')

    root.classList.remove("light", "dark")

    let appliedTheme = resolveTheme(theme)
    
    root.classList.add(appliedTheme)

    // Update the theme-color meta tag
    if (themeColorMeta) {
      const themeColor = THEME_COLORS[appliedTheme]
      themeColorMeta.setAttribute("content", themeColor)
    }
    
    // Add listener for system theme changes
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      
      const handleChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? "dark" : "light"
        root.classList.remove("light", "dark")
        root.classList.add(newTheme)
        
        if (themeColorMeta) {
          const themeColor = THEME_COLORS[newTheme]
          themeColorMeta.setAttribute("content", themeColor)
        }
      }
      
      mediaQuery.addEventListener("change", handleChange)
      
      return () => {
        mediaQuery.removeEventListener("change", handleChange)
      }
    }
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

export const useThemeColor = () => {
  const { theme } = useTheme()
  const [themeColor, setThemeColor] = useState<string>(() => {
    const resolvedTheme = resolveTheme(theme)
    return THEME_COLORS[resolvedTheme]
  })
  
  useEffect(() => {
    const updateThemeColor = () => {
      const resolvedTheme = resolveTheme(theme)
      setThemeColor(THEME_COLORS[resolvedTheme])
    }
    
    updateThemeColor()
    
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      mediaQuery.addEventListener("change", updateThemeColor)
      return () => mediaQuery.removeEventListener("change", updateThemeColor)
    }
  }, [theme])
  
  return themeColor
}
