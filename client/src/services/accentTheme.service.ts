import { useState, useEffect } from 'react';
import { ACCENT_COLORS, ColorOption } from '../types/onboarding';

export const ACCENT_STORAGE_KEY = 'devflow_accent_color';

/**
 * Retrieves the user's selected accent color from:
 * 1. Dedicated 'devflow_accent_color' localStorage item
 * 2. Onboarding draft 'devflow_onboarding_draft' -> data.accentColor
 * 3. Authenticated user profile 'devflow_auth_user' -> accentColor
 * 4. Fallback default: #8B5CF6 (Cosmic Violet from ACCENT_COLORS)
 */
export function getSavedAccentColor(): string {
  if (typeof window === 'undefined') return '#8B5CF6';

  try {
    // 1. Direct explicit setting
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (saved && /^#[0-9A-Fa-f]{6}$/.test(saved)) {
      return saved;
    }

    // 2. Draft from onboarding flow
    const draft = localStorage.getItem('devflow_onboarding_draft');
    if (draft) {
      const parsed = JSON.parse(draft);
      if (parsed?.data?.accentColor && /^#[0-9A-Fa-f]{6}$/.test(parsed.data.accentColor)) {
        return parsed.data.accentColor;
      }
    }

    // 3. User object
    const userStr = localStorage.getItem('devflow_auth_user');
    if (userStr) {
      const parsed = JSON.parse(userStr);
      if (parsed?.accentColor && /^#[0-9A-Fa-f]{6}$/.test(parsed.accentColor)) {
        return parsed.accentColor;
      }
    }
  } catch (err) {
    console.warn('Failed to read accent color from storage:', err);
  }

  // Fallback default from ACCENT_COLORS
  return '#8B5CF6';
}

/**
 * Finds the matching color metadata (name, borderHex, etc.)
 */
export function getAccentColorMeta(hex: string): ColorOption {
  const match = ACCENT_COLORS.find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase()
  );
  if (match) return match;

  return {
    id: 'custom',
    name: 'Custom',
    hex,
    borderHex: hex,
  };
}

/**
 * Saves and broadcasts a new accent color
 */
export function saveAccentColor(hex: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, hex);
    applyAccentColorCss(hex);
    window.dispatchEvent(new CustomEvent('devflow-accent-color-change', { detail: hex }));
  } catch (err) {
    console.error('Failed to save accent color:', err);
  }
}

/**
 * Injects CSS variables onto documentElement for dynamic CSS styling
 */
export function applyAccentColorCss(hex: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--settings-accent', hex);
  root.style.setProperty('--settings-accent-hover', `${hex}dd`);
  root.style.setProperty('--settings-accent-glow', `${hex}40`);
  root.style.setProperty('--settings-accent-bg-subtle', `${hex}18`);
  root.style.setProperty('--settings-accent-border', `${hex}45`);
}

/**
 * React hook to read and observe accent color changes across the application
 */
export function useAccentTheme() {
  const [accentColor, setAccentColorState] = useState<string>(() => getSavedAccentColor());

  useEffect(() => {
    // Initial CSS variable injection
    applyAccentColorCss(accentColor);

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail && /^#[0-9A-Fa-f]{6}$/.test(customEvent.detail)) {
        setAccentColorState(customEvent.detail);
        applyAccentColorCss(customEvent.detail);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === ACCENT_STORAGE_KEY && e.newValue && /^#[0-9A-Fa-f]{6}$/.test(e.newValue)) {
        setAccentColorState(e.newValue);
        applyAccentColorCss(e.newValue);
      }
    };

    window.addEventListener('devflow-accent-color-change', handleCustomEvent);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('devflow-accent-color-change', handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [accentColor]);

  const setAccent = (newHex: string) => {
    saveAccentColor(newHex);
    setAccentColorState(newHex);
  };

  const meta = getAccentColorMeta(accentColor);

  return {
    accentColor,
    meta,
    borderHex: meta.borderHex,
    setAccentColor: setAccent,
  };
}
