import { defineContentScript } from "#imports";
import { browser } from "wxt/browser";

import {
  ensureDevinRedirectButtons,
  removeDevinRedirectButtons,
} from "../lib/github-devin-redirect";
import { ensureHtmlPreviewButtons, removeHtmlPreviews } from "../lib/github-html-preview";
import { ensurePrCopyButtons, removePrCopyButtons } from "../lib/github-pr-copy";
import { getExtensionSettings, type EnhancerSettings } from "../lib/settings";

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

const BRANCH_LINK_SELECTOR = "a[class*='BranchName'][href*='/tree/']";
const EMBEDDED_DATA_SELECTOR = "script[data-target='react-app.embeddedData']";
const SHA2_SOURCE_SELECTOR = "[src*='sha2='], [action*='sha2=']";
export const GITHUB_CONTENT_MATCHES = ["https://github.com/*"];

export const getRepositoryFromLocation = (url: URL): RepositoryLocation | null => {
  if (url.hostname !== "github.com") {
    return null;
  }

  const [owner, repo, section, pullNumber] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo || section !== "pull" || !pullNumber) {
    return null;
  }

  return { owner, repo, pullNumber };
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
  const embeddedData = doc.querySelector<HTMLScriptElement>(EMBEDDED_DATA_SELECTOR)?.textContent;
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

const getBranchLinks = (doc: Document): HTMLAnchorElement[] =>
  Array.from(doc.querySelectorAll<HTMLAnchorElement>(BRANCH_LINK_SELECTOR));

const getHeadBranchLink = (doc: Document): HTMLAnchorElement | undefined =>
  getBranchLinks(doc).at(-1);

const getSha2Candidates = (doc: Document): (string | null)[] =>
  Array.from(doc.querySelectorAll<HTMLElement>(SHA2_SOURCE_SELECTOR)).map((element) =>
    getSha2FromUrl(element.getAttribute("src") ?? element.getAttribute("action") ?? ""),
  );

export const getHeadRef = (doc: Document): string | null => {
  const pullRequest = getEmbeddedPullRequest(doc);
  const candidates = [
    pullRequest?.headSha,
    doc.querySelector<HTMLElement>("[data-head-sha]")?.dataset.headSha,
    doc.querySelector<HTMLMetaElement>("meta[name='octolytics-dimension-head_sha']")?.content,
    doc.querySelector<HTMLElement>(".commit-ref.head-ref")?.textContent?.trim(),
    getHeadBranchLink(doc)?.textContent?.trim(),
    ...getSha2Candidates(doc),
  ];

  return candidates.find((candidate) => candidate && candidate.length > 0) ?? null;
};

export const getPullRequestHeadLocation = (doc: Document): PullRequestHeadLocation => {
  const pullRequest = getEmbeddedPullRequest(doc);
  const headLink = getHeadBranchLink(doc);
  const [, sourceOwner, sourceRepo] = headLink?.pathname.match(/^\/([^/]+)\/([^/]+)\/tree\//) ?? [];

  return {
    ref: getHeadRef(doc) ?? undefined,
    sourceOwner: pullRequest?.headRepositoryOwnerLogin ?? sourceOwner,
    sourceRepo: pullRequest?.headRepositoryName ?? sourceRepo,
  };
};

export const applySettings = (
  settings: EnhancerSettings,
  url: URL = new URL(window.location.href),
): void => {
  if (settings.devinRedirectEnabled) {
    ensureDevinRedirectButtons();
  } else {
    removeDevinRedirectButtons();
  }

  const repository = getRepositoryFromLocation(url);
  if (!repository) {
    removePrCopyButtons();
    removeHtmlPreviews();
    return;
  }

  if (settings.prCopyEnabled) {
    ensurePrCopyButtons();
  } else {
    removePrCopyButtons();
  }

  if (!settings.htmlPreviewEnabled) {
    removeHtmlPreviews();
    return;
  }

  const headLocation = getPullRequestHeadLocation(document);
  ensureHtmlPreviewButtons(document, { ...repository, ...headLocation });
};

const applyFeatures = async (): Promise<void> => {
  const settings = await getExtensionSettings();
  applySettings(settings);
};

export default defineContentScript({
  matches: GITHUB_CONTENT_MATCHES,
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
