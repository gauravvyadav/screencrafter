import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Load saved theme
    browser.storage.local.get('theme').then((res) => {
      if (res.theme) setTheme(res.theme as Theme);
    });

    // Listen for storage changes from other parts of the extension (e.g., popup changing theme while dashboard is open)
    const handleStorageChange = (changes: any) => {
      if (changes.theme) {
        setTheme(changes.theme.newValue);
      }
    };
    browser.storage.onChanged.addListener(handleStorageChange);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [theme]);

  useEffect(() => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setResolvedTheme(isDark ? 'dark' : 'light');
    } else {
      setResolvedTheme(theme as 'light' | 'dark');
    }
  }, [theme]);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    browser.storage.local.set({ theme: newTheme });
  };

  const toggleTheme = () => {
    const next: Record<Theme, Theme> = {
      system: 'light',
      light: 'dark',
      dark: 'system'
    };
    updateTheme(next[theme]);
  };

  return { theme, resolvedTheme, toggleTheme, updateTheme, isDark: resolvedTheme === 'dark' };
}
