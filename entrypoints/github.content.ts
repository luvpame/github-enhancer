import { defineContentScript } from "#imports";
import { browser } from "wxt/browser";

import { ensureHtmlPreviewButtons, removeHtmlPreviews } from "../lib/github-html-preview";
import { ensurePrCopyButtons, removePrCopyButtons } from "../lib/github-pr-copy";
import { getSettings, type EnhancerSettings } from "../lib/settings";

interface RepositoryLocation {
  owner: string;
  repo: string;
  pullNumber: string;
}

interface PullRequestHeadLocation {
  ref?: string;
  sourceOwner?: string;
  sourceRepo?: string;
}

interface PullRequestEmbeddedData {
  payload?: {
    pullRequestsLayoutRoute?: {
      pullRequest?: {
        headBranch?: string;
        headRepositoryName?: string;
        headRepositoryOwnerLogin?: string;
        headSha?: string;
      };
    };
  };
}

export const getRepositoryFromLocation = (url: URL): RepositoryLocation | null => {
  if (url.hostname !== "github.com") {
    return null;
  }

  const [owner, repo, section, pullNumber] = url.pathname.split("/").filter(Boolean);
  return owner && repo && section === "pull" && pullNumber ? { owner, repo, pullNumber } : null;
};

export const createStorageChangeHandler = (refresh: () => void): (() => void) => refresh;

const getSha2FromUrl = (url: string): string | null => {
  try {
    return new URL(url, window.location.origin).searchParams.get("sha2");
  } catch {
    return null;
  }
};

const getPullRequestEmbeddedData = (doc: Document): PullRequestEmbeddedData | null => {
  const embeddedData = doc.querySelector<HTMLScriptElement>(
    "script[data-target='react-app.embeddedData']",
  )?.textContent;
  if (!embeddedData) {
    return null;
  }

  try {
    return JSON.parse(embeddedData) as PullRequestEmbeddedData;
  } catch {
    return null;
  }
};

const getEmbeddedPullRequest = (doc: Document) =>
  getPullRequestEmbeddedData(doc)?.payload?.pullRequestsLayoutRoute?.pullRequest;

export const getHeadRef = (doc: Document): string | null => {
  const pullRequest = getEmbeddedPullRequest(doc);
  const candidates = [
    pullRequest?.headSha,
    doc.querySelector<HTMLElement>("[data-head-sha]")?.dataset.headSha,
    doc.querySelector<HTMLMetaElement>("meta[name='octolytics-dimension-head_sha']")?.content,
    doc.querySelector<HTMLElement>(".commit-ref.head-ref")?.textContent?.trim(),
    Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[class*='BranchName'][href*='/tree/']"))
      .at(-1)
      ?.textContent?.trim(),
    ...Array.from(doc.querySelectorAll<HTMLElement>("[src*='sha2='], [action*='sha2=']")).map(
      (element) =>
        getSha2FromUrl(element.getAttribute("src") ?? element.getAttribute("action") ?? ""),
    ),
  ];

  return candidates.find((candidate) => candidate && candidate.length > 0) ?? null;
};

export const getPullRequestHeadLocation = (doc: Document): PullRequestHeadLocation => {
  const pullRequest = getEmbeddedPullRequest(doc);
  const headLink = Array.from(
    doc.querySelectorAll<HTMLAnchorElement>("a[class*='BranchName'][href*='/tree/']"),
  ).at(-1);
  const [, sourceOwner, sourceRepo] = headLink?.pathname.match(/^\/([^/]+)\/([^/]+)\/tree\//) ?? [];

  return {
    ref: getHeadRef(doc) ?? undefined,
    sourceOwner: pullRequest?.headRepositoryOwnerLogin ?? sourceOwner,
    sourceRepo: pullRequest?.headRepositoryName ?? sourceRepo,
  };
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
  const headLocation = getPullRequestHeadLocation(document);
  if (!repository) {
    return;
  }

  ensureHtmlPreviewButtons(document, { ...repository, ...headLocation });
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
