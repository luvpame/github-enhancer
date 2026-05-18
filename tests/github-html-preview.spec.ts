import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  HTML_PREVIEW_BUTTON_CLASS,
  HTML_PREVIEW_PANEL_CLASS,
  buildBlobUrlFromRawUrl,
  buildRawUrl,
  buildRawUrlFromBlobUrl,
  ensureHtmlPreviewButtons,
  extractHtmlFromBlobPage,
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
    vi.unstubAllGlobals();
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

  it("builds authenticated GitHub raw URLs", () => {
    expect(
      buildRawUrl({
        owner: "luvpame",
        repo: "demo",
        ref: "abc123",
        path: "app/index.html",
      }),
    ).toBe("https://github.com/luvpame/demo/raw/refs/heads/abc123/app/index.html");
  });

  it("builds unambiguous raw URLs for branch names with slashes", () => {
    expect(
      buildRawUrl({
        owner: "smartcamp",
        repo: "shogun",
        ref: "salvage0707/SGN-FY26-655",
        path: "docs/plans/stories/STR-FY26-372/SGN-FY26-655/plan.html",
      }),
    ).toBe(
      "https://github.com/smartcamp/shogun/raw/refs/heads/salvage0707/SGN-FY26-655/docs/plans/stories/STR-FY26-372/SGN-FY26-655/plan.html",
    );
  });

  it("keeps commit SHAs unchanged in raw URLs", () => {
    expect(
      buildRawUrl({
        owner: "luvpame",
        repo: "demo",
        ref: "12322913653a4b271361ebac2d32cdcff27785c6",
        path: "app/index.html",
      }),
    ).toBe(
      "https://github.com/luvpame/demo/raw/12322913653a4b271361ebac2d32cdcff27785c6/app/index.html",
    );
  });

  it("builds authenticated GitHub raw URLs from blob URLs", () => {
    expect(
      buildRawUrlFromBlobUrl(
        "https://github.com/luvpame/github-enhancer/blob/12322913653a4b271361ebac2d32cdcff27785c6/fixtures/html-preview-test.html",
      ),
    ).toBe(
      "https://github.com/luvpame/github-enhancer/raw/12322913653a4b271361ebac2d32cdcff27785c6/fixtures/html-preview-test.html",
    );
  });

  it("builds GitHub blob URLs from raw URLs", () => {
    expect(
      buildBlobUrlFromRawUrl(
        "https://github.com/luvpame/github-enhancer/raw/refs/heads/test/html-preview-pr/fixtures/html-preview-test.html",
      ),
    ).toBe(
      "https://github.com/luvpame/github-enhancer/blob/refs/heads/test/html-preview-pr/fixtures/html-preview-test.html",
    );
  });

  it("extracts raw lines from GitHub blob pages", () => {
    const html = `
      <script type="application/json" data-target="react-app.embeddedData">
        ${JSON.stringify({
          payload: {
            "codeViewBlobLayoutRoute.StyledBlob": {
              rawLines: ["<h1>Hello</h1>", "<p>Private</p>"],
            },
          },
        })}
      </script>
    `;

    expect(extractHtmlFromBlobPage(html)).toBe("<h1>Hello</h1>\n<p>Private</p>");
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
      "https://github.com/luvpame/github-enhancer/raw/f9b1f23b6ae7d71860e2e09c9fbbab25408dad67/fixtures/html-preview-test.html",
    );
  });

  it("uses blob links from React diff regions when no global ref is available", async () => {
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
        <a href="/luvpame/github-enhancer/blob/12322913653a4b271361ebac2d32cdcff27785c6/fixtures/html-preview-test.html">
          View file
        </a>
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
      "https://github.com/luvpame/github-enhancer/raw/12322913653a4b271361ebac2d32cdcff27785c6/fixtures/html-preview-test.html",
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

  it("uses the pull request head repo when it differs from the base repo", async () => {
    const fetchHtml = vi.fn().mockResolvedValue("<h1>Hello</h1>");

    ensureHtmlPreviewButtons(document, {
      owner: "base-owner",
      repo: "base-repo",
      sourceOwner: "head-owner",
      sourceRepo: "head-repo",
      ref: "feature/html-preview",
      fetchHtml,
    });

    document.querySelector<HTMLButtonElement>(`.${HTML_PREVIEW_BUTTON_CLASS}`)?.click();
    await Promise.resolve();

    expect(fetchHtml).toHaveBeenCalledWith(
      "https://github.com/head-owner/head-repo/raw/refs/heads/feature/html-preview/app/index.html",
    );
  });

  it("falls back to authenticated blob pages when raw fetch fails", async () => {
    const blobPage = `
      <script type="application/json" data-target="react-app.embeddedData">
        ${JSON.stringify({
          payload: {
            "codeViewBlobLayoutRoute.StyledBlob": {
              rawLines: ["<h1>Private</h1>", "<p>Preview</p>"],
            },
          },
        })}
      </script>
    `;
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("raw blocked"))
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(blobPage),
      });
    vi.stubGlobal("fetch", fetchMock);

    ensureHtmlPreviewButtons(document, {
      owner: "luvpame",
      repo: "demo",
      ref: "abc123",
    });

    document.querySelector<HTMLButtonElement>(`.${HTML_PREVIEW_BUTTON_CLASS}`)?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/luvpame/demo/raw/refs/heads/abc123/app/index.html",
      { credentials: "include" },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/luvpame/demo/blob/refs/heads/abc123/app/index.html",
      { credentials: "include" },
    );
    expect(document.querySelector<HTMLIFrameElement>("iframe")?.srcdoc).toBe(
      "<h1>Private</h1>\n<p>Preview</p>",
    );
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
      "Could not load HTML preview",
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
