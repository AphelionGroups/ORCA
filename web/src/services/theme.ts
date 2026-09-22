import { createSignal } from 'solid-js';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'orca-theme-mode';

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  }
  return 'system';
};

const initialMode = getInitialThemeMode();
const [themeMode, setThemeModeSignal] = createSignal<ThemeMode>(initialMode);
const [resolvedTheme, setResolvedThemeSignal] = createSignal<ResolvedTheme>(
  initialMode === 'system' ? getSystemTheme() : initialMode
);

const applyThemeToDOM = (resolved: ResolvedTheme, mode: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Set data-theme attribute and class for CSS selectors
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', mode);

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
};

export const setThemeMode = (mode: ThemeMode) => {
  setThemeModeSignal(mode);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }

  const resolved = mode === 'system' ? getSystemTheme() : mode;
  setResolvedThemeSignal(resolved);
  applyThemeToDOM(resolved, mode);
};

// Initialize listeners on module load in browser
if (typeof window !== 'undefined') {
  // Apply immediately
  const currentMode = themeMode();
  const initialResolved: ResolvedTheme = currentMode === 'system' ? getSystemTheme() : currentMode;
  applyThemeToDOM(initialResolved, currentMode);

  // Listen to OS system color-scheme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    if (themeMode() === 'system') {
      const newResolved: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolvedThemeSignal(newResolved);
      applyThemeToDOM(newResolved, 'system');
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  } else if ('addListener' in mediaQuery) {
    // Fallback for older browsers
    (mediaQuery as any).addListener(handleSystemThemeChange);
  }
}

// =========================================================
// COLOR CONTRAST & ACCESSIBILITY UTILITIES
// =========================================================

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h % 360;
  if (h < 0) h += 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function parseColorToRgb(color: string): { r: number; g: number; b: number; a: number } | null {
  if (!color || color === 'transparent' || color === 'none') return null;
  const c = color.trim().toLowerCase();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseInt(hex[3] + hex[3], 16) / 255
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255
      };
    }
  }
  const rgbMatch = c.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    return {
      r: Math.round(parseFloat(rgbMatch[1])),
      g: Math.round(parseFloat(rgbMatch[2])),
      b: Math.round(parseFloat(rgbMatch[3])),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1
    };
  }
  const hslMatch = c.match(/hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)/);
  if (hslMatch) {
    const { r, g, b } = hslToRgb(
      parseFloat(hslMatch[1]),
      parseFloat(hslMatch[2]) / 100,
      parseFloat(hslMatch[3]) / 100
    );
    return {
      r,
      g,
      b,
      a: hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1
    };
  }
  return null;
}

export function isDarkColor(color: string): boolean {
  const rgb = parseColorToRgb(color);
  if (!rgb || rgb.a === 0) return false;
  // Perceived brightness (ITU-R BT.601 formula)
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness < 140;
}

/**
 * Computes accessible high-contrast text color based on background:
 * - If background is transparent: adapts to the active theme ('var(--text-main)').
 * - If background is dark: returns light text ('#ffffff').
 * - If background is light: returns dark text ('#0f172a').
 * - If no explicit color is set: adapts to the active theme ('var(--text-main)').
 */
export function getTextColorForBackground(
  bgColor?: string,
  fillStyle?: string,
  blockType?: string
): string {
  // 1. Transparent background or free-floating text without custom color -> adapts to theme
  if (fillStyle === 'transparent' || (!bgColor && blockType === 'text')) {
    return 'var(--text-main)';
  }

  // 2. If no explicit color is set or is transparent -> adapts to theme
  if (!bgColor || bgColor === 'transparent' || bgColor === 'none') {
    return 'var(--text-main)';
  }

  const rgb = parseColorToRgb(bgColor);
  // If alpha channel is effectively 0 -> transparent
  if (!rgb || rgb.a < 0.05) {
    return 'var(--text-main)';
  }

  // 3. Dark background -> light text, Light background -> dark text
  return isDarkColor(bgColor) ? '#ffffff' : '#0f172a';
}

export { themeMode, resolvedTheme };
