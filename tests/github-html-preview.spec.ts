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
