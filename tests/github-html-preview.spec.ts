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

  it("places the preview button next to the file name when GitHub exposes a truncate header", () => {
    document.body.innerHTML = `
      <div data-file-path="fixtures/html-preview-test.html">
        <div class="file-header">
          <div class="file-info">
            <span class="Truncate">
              <a title="fixtures/html-preview-test.html" href="#diff-html">
                fixtures/html-preview-test.html
              </a>
            </span>
          </div>
          <div class="file-actions"></div>
        </div>
      </div>
    `;

    ensureHtmlPreviewButtons(document, {
      owner: "luvpame",
      repo: "github-enhancer",
      ref: "abc123",
      fetchHtml: vi.fn(),
    });

    expect(
      document.querySelector(`.file-info .Truncate > .${HTML_PREVIEW_BUTTON_CLASS}`),
    ).not.toBeNull();
  });

  it("detects GitHub React diff headers", () => {
    document.body.innerHTML = `
      <div class="PullRequestDiffsList-module__diffEntry__djnVa">
        <div role="region" id="diff-8452769c09dc819b72061899930d937ff7509025ab5a93fa30cedd5dd2da2ded">
          <div data-diff-header-wrapper="true">
            <div class="DiffFileHeader-module__diff-file-header__UuNN4">
              <div class="DiffFileHeader-module__file-path-section__ZcmB1">
                <h3 class="DiffFileHeader-module__file-name__VVXpg">
                  <a href="#diff-8452769c09dc819b72061899930d937ff7509025ab5a93fa30cedd5dd2da2ded">
                    <code>\u200Efixtures/html-preview-test.html\u200E</code>
                  </a>
                </h3>
                <button type="button" aria-label="Copy file name to clipboard"></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    expect(findChangedFiles(document).map((file) => file.path)).toEqual([
      "fixtures/html-preview-test.html",
    ]);

    ensureHtmlPreviewButtons(document, {
      owner: "luvpame",
      repo: "github-enhancer",
      ref: "abc123",
      fetchHtml: vi.fn(),
    });

    expect(
      document.querySelector(`[class*="file-path-section"] > .${HTML_PREVIEW_BUTTON_CLASS}`),
    ).not.toBeNull();
  });

  it("renders React diff previews immediately after the header", async () => {
    document.body.innerHTML = `
      <div role="region">
        <div data-diff-header-wrapper="true">
          <div class="DiffFileHeader-module__file-path-section__ZcmB1">
            <h3 class="DiffFileHeader-module__file-name__VVXpg">
              <a href="#diff-html">
                <code>fixtures/html-preview-test.html</code>
              </a>
            </h3>
          </div>
        </div>
        <div class="border position-relative rounded-bottom-2">
          <table></table>
        </div>
      </div>
    `;
    const fetchHtml = vi.fn().mockResolvedValue("<h1>Hello</h1>");

    ensureHtmlPreviewButtons(document, {
      owner: "luvpame",
      repo: "github-enhancer",
      ref: "abc123",
      fetchHtml,
    });

    document.querySelector<HTMLButtonElement>(`.${HTML_PREVIEW_BUTTON_CLASS}`)?.click();
    await Promise.resolve();

    const header = document.querySelector<HTMLElement>("[data-diff-header-wrapper='true']");
    expect(header?.nextElementSibling?.classList.contains(HTML_PREVIEW_PANEL_CLASS)).toBe(true);
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

  it("uses GitHub data-file-path containers and blob links when no global ref is available", async () => {
    document.body.innerHTML = `
      <div data-file-path="fixtures/html-preview-test.html">
        <div class="file-header">
          <a href="/luvpame/github-enhancer/blob/f9b1f23b6ae7d71860e2e09c9fbbab25408dad67/fixtures/html-preview-test.html">
            fixtures/html-preview-test.html
          </a>
        </div>
      </div>
    `;
    const fetchHtml = vi.fn().mockResolvedValue("<h1>Hello</h1>");

    ensureHtmlPreviewButtons(document, {
      owner: "luvpame",
      repo: "github-enhancer",
      fetchHtml,
    });

    document.querySelector<HTMLButtonElement>(`.${HTML_PREVIEW_BUTTON_CLASS}`)?.click();
    await Promise.resolve();

    expect(fetchHtml).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/luvpame/github-enhancer/f9b1f23b6ae7d71860e2e09c9fbbab25408dad67/fixtures/html-preview-test.html",
    );
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
