import { defineContentScript } from "#imports";
import { browser } from "wxt/browser";

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

export const createStorageChangeHandler = (refresh: () => void): (() => void) => refresh;

const getSha2FromUrl = (url: string): string | null => {
  try {
    return new URL(url, window.location.origin).searchParams.get("sha2");
  } catch {
    return null;
  }
};

export const getHeadRef = (doc: Document): string | null => {
  const candidates = [
    doc.querySelector<HTMLElement>("[data-head-sha]")?.dataset.headSha,
    doc.querySelector<HTMLMetaElement>("meta[name='octolytics-dimension-head_sha']")?.content,
    doc.querySelector<HTMLElement>(".commit-ref.head-ref")?.textContent?.trim(),
    ...Array.from(doc.querySelectorAll<HTMLElement>("[src*='sha2='], [action*='sha2=']")).map(
      (element) =>
        getSha2FromUrl(element.getAttribute("src") ?? element.getAttribute("action") ?? ""),
    ),
  ];

  return candidates.find((candidate) => candidate && candidate.length > 0) ?? null;
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
  if (!repository) {
    return;
  }

  ensureHtmlPreviewButtons(document, { ...repository, ref: ref ?? undefined });
};

const applyFeatures = async (): Promise<void> => {
  const settings = await getSettings();
  applySettings(settings);
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
    const handleStorageChange = createStorageChangeHandler(refresh);
    browser.storage.onChanged.addListener(handleStorageChange);

    ctx.onInvalidated(() => {
      observer.disconnect();
      browser.storage.onChanged.removeListener(handleStorageChange);
    });

    refresh();
  },
});
