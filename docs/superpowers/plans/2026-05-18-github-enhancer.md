# github-enhancer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WXT Chrome MV3 extension that adds PR copy buttons and safe HTML previews to GitHub pull request pages, with per-feature popup toggles.

**Architecture:** Keep the content script thin and split behavior into focused modules: settings, PR copy, HTML preview, and popup UI. Settings live in `browser.storage.local`; the GitHub content script reads them, applies enabled features, and removes feature UI when toggles are disabled.

**Tech Stack:** WXT, TypeScript, React 19, Chrome MV3, `browser.storage.local`, jsdom tests through Vite+.

---

## File Structure

- Modify: `package.json` to initialize the package name through the existing template init flow.
- Modify: `README.md`, `AGENTS.md`, `wxt.config.ts`, `entrypoints/background.ts`, `entrypoints/popup/app.tsx`, and template tests through `vp run init github-enhancer`.
- Rename via init: `lib/template-metadata.ts` -> `lib/github-enhancer-metadata.ts`.
- Rename via init: `lib/template-protocol.ts` -> `lib/github-enhancer-protocol.ts`.
- Rename via init: `tests/template-protocol.spec.ts` -> `tests/github-enhancer-protocol.spec.ts`.
- Create: `lib/settings.ts` for settings defaults, storage read/write, and change listener normalization.
- Create: `tests/settings.spec.ts` for settings behavior.
- Modify: `entrypoints/popup/app.tsx` to replace the template ping UI with two feature toggles.
- Modify: `entrypoints/popup/style.css` to style the toggle popup.
- Create: `tests/popup-settings.spec.tsx` for popup behavior if React test helpers are available; otherwise test the popup helpers exported from `app.tsx`.
- Create: `lib/github-pr-copy.ts` for PR title detection, copy buttons, and cleanup.
- Create: `tests/github-pr-copy.spec.ts` for PR copy behavior.
- Create: `lib/github-html-preview.ts` for changed HTML file detection, raw URL resolution, preview insertion, fetch handling, and cleanup.
- Create: `tests/github-html-preview.spec.ts` for HTML preview behavior.
- Create: `entrypoints/github.content.ts` for GitHub PR content script orchestration.
- Create: `tests/github-content.spec.ts` for orchestration helpers if pure helpers are exported.
- Modify: `wxt.config.ts` and `tests/wxt-config.spec.ts` to include permissions and assert extension metadata.
- Modify: `README.md` to document features, toggles, and local load steps.

## Task 1: Initialize Template Identity

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `wxt.config.ts`
- Modify: `entrypoints/background.ts`
- Modify: `entrypoints/popup/app.tsx`
- Rename: `lib/template-metadata.ts` -> `lib/github-enhancer-metadata.ts`
- Rename: `lib/template-protocol.ts` -> `lib/github-enhancer-protocol.ts`
- Rename: `tests/template-protocol.spec.ts` -> `tests/github-enhancer-protocol.spec.ts`
- Modify: `tests/background.spec.ts`
- Modify: `tests/wxt-config.spec.ts`

- [ ] **Step 1: Run template initialization**

Run:

```bash
vp run init github-enhancer
```

Expected: command exits 0 and reports `Initialized project: Github Enhancer (github-enhancer)`.

- [ ] **Step 2: Refresh dependencies**

Run:

```bash
vp install
```

Expected: command exits 0 and refreshes WXT generated files.

- [ ] **Step 3: Verify metadata file content**

Check `lib/github-enhancer-metadata.ts` contains this shape:

```ts
export const extensionName = "Github Enhancer";
export const extensionDescription =
  "Minimal WXT + React + Bun + TypeScript template for browser extensions.";
export const manifestIconPath = "icon/128.png";
```

Do not rewrite the description in this task; update user-facing copy in the README/docs task.

- [ ] **Step 4: Run checks**

Run:

```bash
vp check
vp test
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

Run:

```bash
git add package.json pnpm-lock.yaml README.md AGENTS.md wxt.config.ts entrypoints/background.ts entrypoints/popup/app.tsx lib tests
git commit -m "chore: initialize github-enhancer template"
```

Expected: commit succeeds with only template identity changes.

## Task 2: Add Settings Storage

**Files:**
- Create: `lib/settings.ts`
- Create: `tests/settings.spec.ts`

- [ ] **Step 1: Write failing settings tests**

Create `tests/settings.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  DEFAULT_SETTINGS,
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
    });
  });

  it("ignores non-boolean stored values", () => {
    expect(mergeSettings({ prCopyEnabled: "false" })).toEqual(DEFAULT_SETTINGS);
  });

  it("saves partial settings", async () => {
    const storage = createStorage();

    await saveSettings(storage, { prCopyEnabled: false });

    expect(storage.set).toHaveBeenCalledWith({ prCopyEnabled: false });
    await expect(getSettings(storage)).resolves.toEqual({
      prCopyEnabled: false,
      htmlPreviewEnabled: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
vp test tests/settings.spec.ts
```

Expected: FAIL because `../lib/settings` does not exist.

- [ ] **Step 3: Implement settings module**

Create `lib/settings.ts`:

```ts
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

export const mergeSettings = (stored: Record<string, unknown>): EnhancerSettings => ({
  prCopyEnabled: isBoolean(stored.prCopyEnabled)
    ? stored.prCopyEnabled
    : DEFAULT_SETTINGS.prCopyEnabled,
  htmlPreviewEnabled: isBoolean(stored.htmlPreviewEnabled)
    ? stored.htmlPreviewEnabled
    : DEFAULT_SETTINGS.htmlPreviewEnabled,
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
```

- [ ] **Step 4: Run settings tests**

Run:

```bash
vp test tests/settings.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
vp check
vp test
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/settings.ts tests/settings.spec.ts
git commit -m "feat: add feature settings storage"
```

Expected: commit succeeds.

## Task 3: Replace Popup With Feature Toggles

**Files:**
- Modify: `entrypoints/popup/app.tsx`
- Modify: `entrypoints/popup/style.css`
- Create: `tests/popup-settings.spec.ts`

- [ ] **Step 1: Extract popup helpers with failing tests**

Create `tests/popup-settings.spec.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";

import { getToggleItems } from "../entrypoints/popup/app";

describe("popup toggle items", () => {
  it("shows the two feature toggles in stable order", () => {
    expect(getToggleItems()).toEqual([
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
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
vp test tests/popup-settings.spec.ts
```

Expected: FAIL because `getToggleItems` is not exported.

- [ ] **Step 3: Replace popup app**

Replace `entrypoints/popup/app.tsx` with:

```tsx
import { useEffect, useState } from "react";

import {
  DEFAULT_SETTINGS,
  getSettings,
  saveExtensionSettings,
  type EnhancerSettings,
} from "../../lib/settings";
import { extensionDescription, extensionName } from "../../lib/github-enhancer-metadata";

interface ToggleItem {
  key: keyof EnhancerSettings;
  label: string;
  description: string;
}

export const getToggleItems = (): ToggleItem[] => [
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

const App = () => {
  const [settings, setSettings] = useState<EnhancerSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void getSettings().then((nextSettings) => {
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
```

- [ ] **Step 4: Replace popup styles**

Update `entrypoints/popup/style.css` so the popup uses compact rows:

```css
:root {
  color: #24292f;
  background: #f6f8fa;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  width: 320px;
  margin: 0;
}

button,
input {
  font: inherit;
}

.popup-shell {
  padding: 12px;
}

.card {
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 14px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #57606a;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 18px;
}

.description {
  margin: 6px 0 14px;
  color: #57606a;
  font-size: 13px;
  line-height: 1.4;
}

.toggle-list {
  display: grid;
  gap: 10px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #d8dee4;
  border-radius: 6px;
  padding: 10px;
}

.toggle-label,
.toggle-description {
  display: block;
}

.toggle-label {
  font-size: 14px;
  font-weight: 600;
}

.toggle-description {
  margin-top: 2px;
  color: #57606a;
  font-size: 12px;
  line-height: 1.35;
}

.toggle-row input {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}
```

- [ ] **Step 5: Run popup test**

Run:

```bash
vp test tests/popup-settings.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run verification**

Run:

```bash
vp check
vp test
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

Run:

```bash
git add entrypoints/popup/app.tsx entrypoints/popup/style.css tests/popup-settings.spec.ts
git commit -m "feat: add popup feature toggles"
```

Expected: commit succeeds.

## Task 4: Port PR Copy Feature

**Files:**
- Create: `lib/github-pr-copy.ts`
- Create: `tests/github-pr-copy.spec.ts`

- [ ] **Step 1: Write failing PR copy tests**

Create `tests/github-pr-copy.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  ACTIONS_CONTAINER_CLASS,
  createCopyButtonSpecs,
  ensurePrCopyButtons,
  removePrCopyButtons,
  sanitizeTitleForMarkdownLink,
} from "../lib/github-pr-copy";

const createPrDocument = () => {
  document.body.innerHTML = `
    <main>
      <div id="partial-discussion-header">
        <h1><bdi>Add preview support</bdi> <span>#123</span></h1>
      </div>
    </main>
  `;
};

describe("github-pr-copy", () => {
  beforeEach(() => {
    createPrDocument();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("creates copy specs for title, URL, and Markdown textlink", () => {
    expect(createCopyButtonSpecs("A [test] (PR)", "https://github.com/a/b/pull/1")).toEqual([
      { label: "Title", text: "A [test] (PR)" },
      { label: "Url", text: "https://github.com/a/b/pull/1" },
      { label: "Textlink", text: "[A 【test】 （PR）](https://github.com/a/b/pull/1)" },
    ]);
  });

  it("sanitizes Markdown link delimiters", () => {
    expect(sanitizeTitleForMarkdownLink("[x](y)")).toBe("【x】（y）");
  });

  it("adds one copy button group to the PR header", () => {
    expect(ensurePrCopyButtons(document, "https://github.com/a/b/pull/1")).toBe(true);
    expect(ensurePrCopyButtons(document, "https://github.com/a/b/pull/1")).toBe(false);

    expect(document.querySelectorAll(`.${ACTIONS_CONTAINER_CLASS}`)).toHaveLength(1);
    expect([...document.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      "Title",
      "Url",
      "Textlink",
    ]);
  });

  it("removes inserted buttons", () => {
    ensurePrCopyButtons(document, "https://github.com/a/b/pull/1");
    removePrCopyButtons(document);

    expect(document.querySelector(`.${ACTIONS_CONTAINER_CLASS}`)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
vp test tests/github-pr-copy.spec.ts
```

Expected: FAIL because `../lib/github-pr-copy` does not exist.

- [ ] **Step 3: Implement PR copy module**

Create `lib/github-pr-copy.ts` by porting `luvpame/github-pr-copy` with these public exports:

```ts
export const HEADER_SELECTORS = [
  "#partial-discussion-header h1",
  "h1.gh-header-title",
  "main h1",
] as const;
export const TITLE_SELECTORS = ["[data-testid='issue-title']", ".markdown-title", "bdi"] as const;
export const TITLE_NOISE_PATTERNS = [/^#\d+$/, /^Edit title$/i] as const;

export const ACTIONS_CONTAINER_CLASS = "github-enhancer-pr-copy-actions";
export const COPY_BUTTON_CLASS = "github-enhancer-pr-copy-button";
export const COPIED_BUTTON_CLASS = "is-copied";
export const FEEDBACK_STYLE_ID = "github-enhancer-pr-copy-style";
export const COPIED_LABEL = "✓ Copied";
export const FEEDBACK_DURATION_MS = 1000;

export interface CopyButtonSpec {
  label: "Title" | "Url" | "Textlink";
  text: string;
}
```

Keep these functions exported for tests and content script use:

```ts
export const sanitizeTitleForMarkdownLink = (title: string): string =>
  title.replaceAll("[", "【").replaceAll("]", "】").replaceAll("(", "（").replaceAll(")", "）");

export const createCopyButtonSpecs = (title: string, url: string): CopyButtonSpec[] => [
  { label: "Title", text: title },
  { label: "Url", text: url },
  {
    label: "Textlink",
    text: `[${sanitizeTitleForMarkdownLink(title)}](${url})`,
  },
];
```

Implement `ensurePrCopyButtons(doc, url)` with the same behavior as `luvpame/github-pr-copy`, using the new class names. Implement cleanup:

```ts
export const removePrCopyButtons = (doc: Document = document): void => {
  doc.querySelectorAll(`.${ACTIONS_CONTAINER_CLASS}`).forEach((element) => element.remove());
};
```

- [ ] **Step 4: Run PR copy tests**

Run:

```bash
vp test tests/github-pr-copy.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run verification**

Run:

```bash
vp check
vp test
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/github-pr-copy.ts tests/github-pr-copy.spec.ts
git commit -m "feat: add pull request copy buttons"
```

Expected: commit succeeds.

## Task 5: Add HTML Preview Module

**Files:**
- Create: `lib/github-html-preview.ts`
- Create: `tests/github-html-preview.spec.ts`

- [ ] **Step 1: Write failing HTML preview tests**

Create `tests/github-html-preview.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  HTML_PREVIEW_BUTTON_CLASS,
  HTML_PREVIEW_PANEL_CLASS,
  buildRawUrl,
  ensureHtmlPreviewButtons,
  findChangedFiles,
  removeHtmlPreviews,
} from "../lib/github-html-preview";

const createFilesDocument = () => {
  document.body.innerHTML = `
    <div data-testid="file" data-file-path="app/index.html">
      <div class="file-header">
        <a title="app/index.html" href="#diff-1">app/index.html</a>
      </div>
    </div>
    <div data-testid="file" data-file-path="README.md">
      <div class="file-header">
        <a title="README.md" href="#diff-2">README.md</a>
      </div>
    </div>
  `;
};

describe("github-html-preview", () => {
  beforeEach(() => {
    createFilesDocument();
    vi.restoreAllMocks();
  });

  it("finds changed files and filters HTML files during insertion", () => {
    expect(findChangedFiles(document).map((file) => file.path)).toEqual([
      "app/index.html",
      "README.md",
    ]);

    ensureHtmlPreviewButtons(document, {
      owner: "luvpame",
      repo: "demo",
      ref: "abc123",
      fetchHtml: vi.fn(),
    });

    expect(document.querySelectorAll(`.${HTML_PREVIEW_BUTTON_CLASS}`)).toHaveLength(1);
  });

  it("builds raw GitHub URLs", () => {
    expect(
      buildRawUrl({
        owner: "luvpame",
        repo: "demo",
        ref: "abc123",
        path: "app/index.html",
      }),
    ).toBe("https://raw.githubusercontent.com/luvpame/demo/abc123/app/index.html");
  });

  it("renders a sandboxed iframe after fetch succeeds", async () => {
    const fetchHtml = vi.fn().mockResolvedValue("<h1>Hello</h1>");
    ensureHtmlPreviewButtons(document, {
      owner: "luvpame",
      repo: "demo",
      ref: "abc123",
      fetchHtml,
    });

    document.querySelector<HTMLButtonElement>(`.${HTML_PREVIEW_BUTTON_CLASS}`)?.click();
    await Promise.resolve();

    const iframe = document.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.getAttribute("sandbox")).toBe("");
    expect(iframe?.srcdoc).toBe("<h1>Hello</h1>");
  });

  it("shows an error when fetch fails", async () => {
    const fetchHtml = vi.fn().mockRejectedValue(new Error("not found"));
    ensureHtmlPreviewButtons(document, {
      owner: "luvpame",
      repo: "demo",
      ref: "abc123",
      fetchHtml,
    });

    document.querySelector<HTMLButtonElement>(`.${HTML_PREVIEW_BUTTON_CLASS}`)?.click();
    await Promise.resolve();

    expect(document.querySelector(`.${HTML_PREVIEW_PANEL_CLASS}`)?.textContent).toContain(
      "Could not load HTML preview.",
    );
  });

  it("removes preview buttons and panels", () => {
    ensureHtmlPreviewButtons(document, {
      owner: "luvpame",
      repo: "demo",
      ref: "abc123",
      fetchHtml: vi.fn(),
    });

    removeHtmlPreviews(document);

    expect(document.querySelector(`.${HTML_PREVIEW_BUTTON_CLASS}`)).toBeNull();
    expect(document.querySelector(`.${HTML_PREVIEW_PANEL_CLASS}`)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
vp test tests/github-html-preview.spec.ts
```

Expected: FAIL because `../lib/github-html-preview` does not exist.

- [ ] **Step 3: Implement HTML preview module**

Create `lib/github-html-preview.ts` with these exports and direct DOM behavior:

```ts
export const HTML_PREVIEW_BUTTON_CLASS = "github-enhancer-html-preview-button";
export const HTML_PREVIEW_PANEL_CLASS = "github-enhancer-html-preview-panel";
export const HTML_PREVIEW_STYLE_ID = "github-enhancer-html-preview-style";

export interface RawUrlInput {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

export interface HtmlPreviewContext {
  owner: string;
  repo: string;
  ref: string;
  fetchHtml?: (url: string) => Promise<string>;
}

export interface ChangedFile {
  element: HTMLElement;
  header: HTMLElement;
  path: string;
}

export const buildRawUrl = ({ owner, repo, ref, path }: RawUrlInput): string =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
```

Implement file detection with a simple selector set:

```ts
const FILE_SELECTORS = ["[data-testid='file']", ".file"] as const;

const getFilePath = (element: HTMLElement): string => {
  const fromDataset = element.dataset.filePath;
  if (fromDataset) {
    return fromDataset;
  }

  const titledLink = element.querySelector<HTMLElement>("[title]");
  return titledLink?.getAttribute("title")?.trim() ?? "";
};

export const findChangedFiles = (doc: Document = document): ChangedFile[] => {
  const elements = FILE_SELECTORS.flatMap((selector) =>
    Array.from(doc.querySelectorAll<HTMLElement>(selector)),
  );

  return elements.flatMap((element) => {
    const path = getFilePath(element);
    const header =
      element.querySelector<HTMLElement>(".file-header") ??
      element.querySelector<HTMLElement>("[data-testid='file-header']");

    return path && header ? [{ element, header, path }] : [];
  });
};
```

Implement `ensureHtmlPreviewButtons(doc, context)`:

- Call `ensureHtmlPreviewStyle(doc)`.
- Iterate `findChangedFiles(doc)`.
- Skip paths that do not end with `.html`.
- Skip files that already contain `.${HTML_PREVIEW_BUTTON_CLASS}`.
- Insert a GitHub-style `button.btn.btn-sm` into the file header.
- On click, toggle an existing panel; otherwise fetch the raw URL, create a panel, and render an iframe.
- Use `iframe.setAttribute("sandbox", "")` and `iframe.srcdoc = html`.
- On error, create a panel with `Could not load HTML preview.`.

Implement cleanup:

```ts
export const removeHtmlPreviews = (doc: Document = document): void => {
  doc.querySelectorAll(`.${HTML_PREVIEW_BUTTON_CLASS}`).forEach((element) => element.remove());
  doc.querySelectorAll(`.${HTML_PREVIEW_PANEL_CLASS}`).forEach((element) => element.remove());
};
```

- [ ] **Step 4: Run HTML preview tests**

Run:

```bash
vp test tests/github-html-preview.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run verification**

Run:

```bash
vp check
vp test
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/github-html-preview.ts tests/github-html-preview.spec.ts
git commit -m "feat: add HTML file previews"
```

Expected: commit succeeds.

## Task 6: Wire GitHub Content Script and Manifest Permissions

**Files:**
- Create: `entrypoints/github.content.ts`
- Modify: `wxt.config.ts`
- Modify: `tests/wxt-config.spec.ts`
- Create: `tests/github-content.spec.ts`

- [ ] **Step 1: Write WXT config test changes**

Update `tests/wxt-config.spec.ts` expectations to include GitHub permissions:

```ts
expect(manifest.permissions).toContain("storage");
expect(manifest.host_permissions).toContain("https://github.com/*");
expect(manifest.host_permissions).toContain("https://raw.githubusercontent.com/*");
```

Keep existing name, description, icon, and React module expectations.

- [ ] **Step 2: Write content helper tests**

Create `tests/github-content.spec.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";

import { getRepositoryFromLocation } from "../entrypoints/github.content";

describe("github content helpers", () => {
  it("extracts owner and repo from GitHub PR URLs", () => {
    expect(getRepositoryFromLocation(new URL("https://github.com/luvpame/demo/pull/1"))).toEqual({
      owner: "luvpame",
      repo: "demo",
    });
  });

  it("ignores non-PR URLs", () => {
    expect(getRepositoryFromLocation(new URL("https://github.com/luvpame/demo"))).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
vp test tests/wxt-config.spec.ts tests/github-content.spec.ts
```

Expected: FAIL because manifest permissions and content helper do not exist yet.

- [ ] **Step 4: Update manifest config**

Update `wxt.config.ts` manifest:

```ts
export const manifest = {
  name: extensionName,
  description: extensionDescription,
  permissions: ["storage"],
  host_permissions: ["https://github.com/*", "https://raw.githubusercontent.com/*"],
  icons: {
    16: manifestIconPath,
    32: manifestIconPath,
    48: manifestIconPath,
    128: manifestIconPath,
  },
};
```

- [ ] **Step 5: Create content script**

Create `entrypoints/github.content.ts`:

```ts
import { defineContentScript } from "#imports";

import { ensureHtmlPreviewButtons, removeHtmlPreviews } from "../lib/github-html-preview";
import { ensurePrCopyButtons, removePrCopyButtons } from "../lib/github-pr-copy";
import { getSettings, type EnhancerSettings } from "../lib/settings";

interface RepositoryLocation {
  owner: string;
  repo: string;
}

export const getRepositoryFromLocation = (url: URL): RepositoryLocation | null => {
  if (url.hostname !== "github.com") {
    return null;
  }

  const [owner, repo, section] = url.pathname.split("/").filter(Boolean);
  return owner && repo && section === "pull" ? { owner, repo } : null;
};

const getHeadRef = (doc: Document): string | null => {
  const candidates = [
    doc.querySelector<HTMLElement>("[data-head-sha]")?.dataset.headSha,
    doc.querySelector<HTMLMetaElement>("meta[name='octolytics-dimension-head_sha']")?.content,
    doc.querySelector<HTMLElement>(".commit-ref.head-ref")?.textContent?.trim(),
  ];

  return candidates.find((candidate) => candidate && candidate.length > 0) ?? null;
};

const applyFeatures = async (): Promise<void> => {
  const settings = await getSettings();
  applySettings(settings);
};

const applySettings = (settings: EnhancerSettings): void => {
  if (settings.prCopyEnabled) {
    ensurePrCopyButtons();
  } else {
    removePrCopyButtons();
  }

  if (!settings.htmlPreviewEnabled) {
    removeHtmlPreviews();
    return;
  }

  const repository = getRepositoryFromLocation(new URL(window.location.href));
  const ref = getHeadRef(document);
  if (!repository || !ref) {
    return;
  }

  ensureHtmlPreviewButtons(document, { ...repository, ref });
};

export default defineContentScript({
  matches: ["https://github.com/*/*/pull/*"],
  main(ctx) {
    const refresh = () => {
      void applyFeatures();
    };
    const observer = new MutationObserver(refresh);
    const observedNode = document.body ?? document.documentElement;

    observer.observe(observedNode, {
      childList: true,
      subtree: true,
    });

    ctx.addEventListener(window, "wxt:locationchange", refresh);
    ctx.onInvalidated(() => {
      observer.disconnect();
    });

    refresh();
  },
});
```

- [ ] **Step 6: Run content/config tests**

Run:

```bash
vp test tests/wxt-config.spec.ts tests/github-content.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Run verification**

Run:

```bash
vp check
vp test
vp run build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

Run:

```bash
git add entrypoints/github.content.ts wxt.config.ts tests/wxt-config.spec.ts tests/github-content.spec.ts
git commit -m "feat: wire GitHub content script"
```

Expected: commit succeeds.

## Task 7: Apply Settings Changes Live

**Files:**
- Modify: `entrypoints/github.content.ts`
- Modify: `tests/github-content.spec.ts`

- [ ] **Step 1: Add live refresh helper tests**

Append to `tests/github-content.spec.ts`:

```ts
import { createStorageChangeHandler } from "../entrypoints/github.content";

it("creates a storage change handler that refreshes features", () => {
  let calls = 0;
  const handler = createStorageChangeHandler(() => {
    calls += 1;
  });

  handler();

  expect(calls).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
vp test tests/github-content.spec.ts
```

Expected: FAIL because `createStorageChangeHandler` is not exported.

- [ ] **Step 3: Implement the storage change helper**

Update `entrypoints/github.content.ts`:

```ts
export const createStorageChangeHandler =
  (refresh: () => void) => (): void => {
    refresh();
  };
```

- [ ] **Step 4: Listen for setting changes in content script**

Import `browser` from `wxt/browser` at the top:

```ts
import { browser } from "wxt/browser";
```

Inside `main(ctx)`, add:

```ts
const handleStorageChange = createStorageChangeHandler(refresh);

browser.storage.onChanged.addListener(handleStorageChange);
ctx.onInvalidated(() => {
  observer.disconnect();
  browser.storage.onChanged.removeListener(handleStorageChange);
});
```

Keep only one `ctx.onInvalidated` block after this change.

- [ ] **Step 5: Run verification**

Run:

```bash
vp check
vp test
vp run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add entrypoints/github.content.ts tests/github-content.spec.ts
git commit -m "feat: apply feature toggles live"
```

Expected: commit succeeds.

## Task 8: Update README and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `lib/github-enhancer-metadata.ts`

- [ ] **Step 1: Update extension metadata**

Update `lib/github-enhancer-metadata.ts`:

```ts
export const extensionName = "Github Enhancer";
export const extensionDescription =
  "Adds pull request copy shortcuts and HTML previews to GitHub.";
export const manifestIconPath = "icon/128.png";
```

- [ ] **Step 2: Replace README content**

Replace `README.md` with:

```md
# Github Enhancer

WXT-based Chrome extension that enhances GitHub pull request pages.

## Features

- Adds `Title`, `Url`, and `Textlink` copy buttons to pull request titles
- Adds `Preview HTML` buttons for changed `.html` files in pull requests
- Provides popup toggles for PR copy and HTML preview
- Renders HTML previews in sandboxed iframes

## Requirements

- `mise`
- Node.js 24 and pnpm 10 via `mise install`
- Chrome or Chromium

## Setup

```bash
mise install
vp install
```

## Commands

```bash
vp check
vp test
vp run dev
vp run build
vp run zip
```

## Build Output

- Chrome MV3: `.output/chrome-mv3/`

## Load Unpacked

1. Open `chrome://extensions/`
2. Enable developer mode
3. Choose `Load unpacked`
4. Select `.output/chrome-mv3/`
```

- [ ] **Step 3: Apply required simplification pass**

Use the `code-simplifier` skill on the code changed during implementation. Keep only simplifications that preserve behavior and do not broaden scope.

- [ ] **Step 4: Run final verification**

Run:

```bash
vp check
vp test
vp run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended README and metadata changes remain unstaged.

- [ ] **Step 6: Commit**

Run:

```bash
git add README.md lib/github-enhancer-metadata.ts
git commit -m "docs: document github-enhancer usage"
```

Expected: commit succeeds.

## Self-Review Checklist

- Spec coverage: PR copy, HTML preview, popup toggles, settings defaults, safe iframe rendering, raw URL fetching, and tests are each covered by tasks.
- Placeholder scan: no incomplete markers or undefined implementation steps remain.
- Type consistency: `EnhancerSettings`, `prCopyEnabled`, `htmlPreviewEnabled`, `ensurePrCopyButtons`, `removePrCopyButtons`, `ensureHtmlPreviewButtons`, and `removeHtmlPreviews` are used consistently across tasks.
- Scope check: asset URL rewriting, automatic previews, global on/off, and deeper GitHub rendered-diff integration remain out of scope.
