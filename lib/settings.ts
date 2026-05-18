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

export const getExtensionStorage = (
  storage: SettingsStorage | null | undefined = browser.storage?.local,
): SettingsStorage | null => storage ?? null;

export const getSettings = async (storage: SettingsStorage): Promise<EnhancerSettings> =>
  mergeSettings(await storage.get(SETTING_KEYS));

export const saveSettings = (
  storage: SettingsStorage,
  values: Partial<EnhancerSettings>,
): Promise<void> => storage.set(values);

export const getExtensionSettings = async (
  storage: SettingsStorage | null = getExtensionStorage(),
): Promise<EnhancerSettings> => (storage ? getSettings(storage) : DEFAULT_SETTINGS);

export const saveExtensionSettings = async (
  values: Partial<EnhancerSettings>,
  storage: SettingsStorage | null = getExtensionStorage(),
): Promise<void> => {
  if (storage) {
    await saveSettings(storage, values);
  }
};
