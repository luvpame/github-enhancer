import { useEffect, useState } from "react";

import { extensionDescription, extensionName } from "../../lib/github-enhancer-metadata";
import {
  DEFAULT_SETTINGS,
  getExtensionSettings,
  saveExtensionSettings,
  type EnhancerSettings,
} from "../../lib/settings";

interface ToggleItem {
  key: keyof EnhancerSettings;
  label: string;
  description: string;
}

const TOGGLE_ITEMS: ToggleItem[] = [
  {
    key: "prCopyEnabled",
    label: "PR copy",
    description: "Add Title, Url, and Textlink copy buttons to pull requests.",
  },
  {
    key: "htmlPreviewEnabled",
    label: "HTML preview",
    description: "Add Preview HTML buttons to changed HTML files.",
  },
];

export const getToggleItems = (): ToggleItem[] => TOGGLE_ITEMS;

const App = () => {
  const [settings, setSettings] = useState<EnhancerSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void getExtensionSettings().then((nextSettings) => {
      setSettings(nextSettings);
      setIsLoading(false);
    });
  }, []);

  const updateSetting = async (key: keyof EnhancerSettings, checked: boolean): Promise<void> => {
    const nextSettings = { ...settings, [key]: checked };
    setSettings(nextSettings);
    await saveExtensionSettings({ [key]: checked });
  };

  return (
    <main className="popup-shell">
      <section className="card">
        <p className="eyebrow">GitHub tools</p>
        <h1>{extensionName}</h1>
        <p className="description">{extensionDescription}</p>
        <div className="toggle-list" aria-busy={isLoading}>
          {getToggleItems().map((item) => (
            <label className="toggle-row" key={item.key}>
              <span>
                <span className="toggle-label">{item.label}</span>
                <span className="toggle-description">{item.description}</span>
              </span>
              <input
                type="checkbox"
                checked={settings[item.key]}
                disabled={isLoading}
                onChange={(event) => {
                  void updateSetting(item.key, event.currentTarget.checked);
                }}
              />
            </label>
          ))}
        </div>
      </section>
    </main>
  );
};

export default App;
