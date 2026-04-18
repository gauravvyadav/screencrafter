import { Sun, Moon, Monitor } from 'lucide-react';
import type { Theme } from '@/hooks/useTheme';

interface ThemeToggleProps {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  size?: number;
}

export function ThemeToggle({ theme, toggleTheme, isDark, size = 17 }: ThemeToggleProps) {
  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
      title={`Theme: ${theme}`}
    >
      {theme === 'system' ? <Monitor size={size} /> : theme === 'light' ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  );
}
