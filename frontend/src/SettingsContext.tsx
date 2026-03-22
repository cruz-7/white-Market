import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Language, getTranslations, TranslationKeys } from './i18n';

// Theme types
export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'purple' | 'blue' | 'green' | 'orange' | 'red';

// Notification settings interface
export interface NotificationSettings {
  pushNotifications: boolean;
  emailAlerts: boolean;
  smsNotifications: boolean;
  orderUpdates: boolean;
  newMessages: boolean;
  promotions: boolean;
  referralUpdates: boolean;
}

// Privacy settings interface
export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  showEmail: boolean;
  showPhone: boolean;
  dataSharing: boolean;
}

// Complete settings interface
export interface AppSettings {
  theme: Theme;
  colorScheme: ColorScheme;
  language: Language;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

// Default settings
const defaultNotificationSettings: NotificationSettings = {
  pushNotifications: true,
  emailAlerts: true,
  smsNotifications: false,
  orderUpdates: true,
  newMessages: true,
  promotions: false,
  referralUpdates: true,
};

const defaultPrivacySettings: PrivacySettings = {
  profileVisibility: 'public',
  showEmail: false,
  showPhone: false,
  dataSharing: false,
};

const defaultSettings: AppSettings = {
  theme: 'light',
  colorScheme: 'purple',
  language: 'en',
  notifications: defaultNotificationSettings,
  privacy: defaultPrivacySettings,
};

// Settings context type
interface SettingsContextType {
  settings: AppSettings;
  translations: TranslationKeys;
  theme: Theme;
  colorScheme: ColorScheme;
  language: Language;
  isDarkMode: boolean;
  setTheme: (theme: Theme) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setLanguage: (lang: Language) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;
  resetSettings: () => void;
}

// Create context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEY = 'wm_settings';

// Load settings from localStorage
const loadSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return {
        ...defaultSettings,
        ...parsed,
        notifications: { ...defaultNotificationSettings, ...parsed.notifications },
        privacy: { ...defaultPrivacySettings, ...parsed.privacy },
      };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return defaultSettings;
};

// Save settings to localStorage
const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

// Check if dark mode should be active
const checkIsDarkMode = (theme: Theme): boolean => {
  if (theme === 'dark') return true;
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};

// Provider component
interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => checkIsDarkMode(settings.theme));
  
  // Get translations for current language
  const translations = getTranslations(settings.language);

  // Save settings whenever they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Apply theme changes to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Apply color scheme as CSS variable
    const colors: Record<ColorScheme, { primary: string; primaryForeground: string }> = {
      purple: { primary: '224 71% 4%', primaryForeground: '210 40% 98%' },
      blue: { primary: '221.2 83.2% 53.3%', primaryForeground: '210 40% 98%' },
      green: { primary: '142 76% 36%', primaryForeground: '210 40% 98%' },
      orange: { primary: '25 95% 53%', primaryForeground: '210 40% 98%' },
      red: { primary: '0 84% 60%', primaryForeground: '210 40% 98%' },
    };
    
    const color = colors[settings.colorScheme];
    root.style.setProperty('--primary', color.primary);
    root.style.setProperty('--primary-foreground', color.primaryForeground);
  }, [isDarkMode, settings.colorScheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  // Update dark mode when theme changes
  useEffect(() => {
    setIsDarkMode(checkIsDarkMode(settings.theme));
  }, [settings.theme]);

  // Theme setter
  const setTheme = useCallback((theme: Theme) => {
    setSettings(prev => ({ ...prev, theme }));
  }, []);

  // Color scheme setter
  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setSettings(prev => ({ ...prev, colorScheme: scheme }));
  }, []);

  // Language setter
  const setLanguage = useCallback((lang: Language) => {
    setSettings(prev => ({ ...prev, language: lang }));
    // Dispatch event for components that need to react to language change
    window.dispatchEvent(new CustomEvent('wm-language-change', { detail: { language: lang } }));
  }, []);

  // Notification settings updater
  const updateNotificationSettings = useCallback((updates: Partial<NotificationSettings>) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, ...updates },
    }));
  }, []);

  // Privacy settings updater
  const updatePrivacySettings = useCallback((updates: Partial<PrivacySettings>) => {
    setSettings(prev => ({
      ...prev,
      privacy: { ...prev.privacy, ...updates },
    }));
  }, []);

  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  const value: SettingsContextType = {
    settings,
    translations,
    theme: settings.theme,
    colorScheme: settings.colorScheme,
    language: settings.language,
    isDarkMode,
    setTheme,
    setColorScheme,
    setLanguage,
    updateNotificationSettings,
    updatePrivacySettings,
    resetSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// Hook to use settings
export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// Convenience hook for translations
export function useTranslation(): TranslationKeys {
  const { translations } = useSettings();
  return translations;
}

export default SettingsContext;
