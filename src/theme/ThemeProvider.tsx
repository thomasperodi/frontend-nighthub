import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dark, light, Theme } from "./themes";

const THEME_KEY = "app-theme";

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  setThemeMode: (mode: "light" | "dark") => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: any) => {
  const [theme, setTheme] = useState<Theme>(dark);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_KEY);
        if (raw === "light") setTheme(light);
        else setTheme(dark);
      } catch (e) {
        setTheme(dark);
      }
    })();
  }, []);

  const setThemeMode = async (mode: "light" | "dark") => {
    try {
      await AsyncStorage.setItem(THEME_KEY, mode);
    } catch (e) {
      // ignore
    }
    setTheme(mode === "light" ? light : dark);
  };

  const toggleTheme = () => setThemeMode(theme.mode === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme.mode === "dark", setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
