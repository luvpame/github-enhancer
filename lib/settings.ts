import { browser } from "wxt/browser";

export interface EnhancerSettings {
  prCopyEnabled: boolean;
  htmlPreviewEnabled: boolean;
}

export interface SettingsStorage {
  get: (keys: (keyof EnhancerSettings)[]) => Promise<Record<string, unknown>>;
  set: (values: Partial<EnhancerSettings>) => Promise<void>;
}

export const DEFAULT_SETTINGS: EnhancerSettings = {
  prCopyEnabled: true,
  htmlPreviewEnabled: true,
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof EnhancerSettings)[];

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const getStoredBoolean = (
  stored: Record<string, unknown>,
  key: keyof EnhancerSettings,
): boolean => {
  const value = stored[key];

  return isBoolean(value) ? value : DEFAULT_SETTINGS[key];
};

export const mergeSettings = (stored: Record<string, unknown>): EnhancerSettings => ({
  prCopyEnabled: getStoredBoolean(stored, "prCopyEnabled"),
  htmlPreviewEnabled: getStoredBoolean(stored, "htmlPreviewEnabled"),
});

export const getSettings = async (
  storage: SettingsStorage = browser.storage.local,
): Promise<EnhancerSettings> => mergeSettings(await storage.get(SETTING_KEYS));

export const saveSettings = (
  storage: SettingsStorage,
  values: Partial<EnhancerSettings>,
): Promise<void> => storage.set(values);

export const saveExtensionSettings = (values: Partial<EnhancerSettings>): Promise<void> =>
  saveSettings(browser.storage.local, values);
