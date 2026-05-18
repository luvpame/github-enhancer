import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  DEFAULT_SETTINGS,
  getExtensionSettings,
  getExtensionStorage,
  getSettings,
  mergeSettings,
  saveSettings,
  type EnhancerSettings,
  type SettingsStorage,
} from "../lib/settings";

const createStorage = (initial: Partial<EnhancerSettings> = {}): SettingsStorage => {
  let value = { ...initial };

  return {
    get: vi.fn().mockImplementation(async () => value),
    set: vi.fn().mockImplementation(async (next: Partial<EnhancerSettings>) => {
      value = { ...value, ...next };
    }),
  };
};

describe("settings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults both features to enabled", async () => {
    const storage = createStorage();

    await expect(getSettings(storage)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("merges saved values with defaults", async () => {
    const storage = createStorage({ htmlPreviewEnabled: false });

    await expect(getSettings(storage)).resolves.toEqual({
      prCopyEnabled: true,
      htmlPreviewEnabled: false,
      devinRedirectEnabled: true,
    });
  });

  it("ignores non-boolean stored values", () => {
    expect(mergeSettings({ prCopyEnabled: "false" })).toEqual(DEFAULT_SETTINGS);
  });

  it("returns no extension storage when unavailable", () => {
    expect(getExtensionStorage(null)).toBeNull();
  });

  it("uses default settings when extension storage is unavailable", async () => {
    await expect(getExtensionSettings(null)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("saves partial settings", async () => {
    const storage = createStorage();

    await saveSettings(storage, { prCopyEnabled: false });

    expect(storage.set).toHaveBeenCalledWith({ prCopyEnabled: false });
    await expect(getSettings(storage)).resolves.toEqual({
      prCopyEnabled: false,
      htmlPreviewEnabled: true,
      devinRedirectEnabled: true,
    });
  });
});
