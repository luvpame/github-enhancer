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

const FILE_SELECTORS = ["[data-testid='file']", ".file"] as const;

const defaultFetchHtml = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch HTML preview: ${response.status}`);
  }

  return response.text();
};

export const buildRawUrl = ({ owner, repo, ref, path }: RawUrlInput): string =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;

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
  const uniqueElements = [...new Set(elements)];

  return uniqueElements.flatMap((element) => {
    const path = getFilePath(element);
    const header =
      element.querySelector<HTMLElement>(".file-header") ??
      element.querySelector<HTMLElement>("[data-testid='file-header']");

    return path && header ? [{ element, header, path }] : [];
  });
};

const ensureHtmlPreviewStyle = (doc: Document): void => {
  if (doc.getElementById(HTML_PREVIEW_STYLE_ID)) {
    return;
  }

  const styleElement = doc.createElement("style");
  styleElement.id = HTML_PREVIEW_STYLE_ID;
  styleElement.textContent = `
    .${HTML_PREVIEW_BUTTON_CLASS} {
      margin-left: 8px;
    }

    .${HTML_PREVIEW_PANEL_CLASS} {
      border-top: 1px solid var(--borderColor-default, #d0d7de);
      background: var(--bgColor-default, #ffffff);
      padding: 12px;
    }

    .${HTML_PREVIEW_PANEL_CLASS} iframe {
      width: 100%;
      min-height: 360px;
      border: 1px solid var(--borderColor-default, #d0d7de);
      border-radius: 6px;
      background: #ffffff;
    }
  `;

  (doc.head ?? doc.body).appendChild(styleElement);
};

const createPanel = (doc: Document): HTMLDivElement => {
  const panel = doc.createElement("div");
  panel.classList.add(HTML_PREVIEW_PANEL_CLASS);

  return panel;
};

const renderIframe = (doc: Document, html: string): HTMLDivElement => {
  const panel = createPanel(doc);
  const iframe = doc.createElement("iframe");
  iframe.setAttribute("sandbox", "");
  iframe.srcdoc = html;
  panel.appendChild(iframe);

  return panel;
};

const renderMessage = (doc: Document, message: string): HTMLDivElement => {
  const panel = createPanel(doc);
  panel.textContent = message;

  return panel;
};

const toggleExistingPanel = (fileElement: HTMLElement): boolean => {
  const existingPanel = fileElement.querySelector(`.${HTML_PREVIEW_PANEL_CLASS}`);
  if (!(existingPanel instanceof HTMLElement)) {
    return false;
  }

  existingPanel.remove();
  return true;
};

const loadPreview = async (
  doc: Document,
  file: ChangedFile,
  context: HtmlPreviewContext & { fetchHtml: (url: string) => Promise<string> },
): Promise<void> => {
  if (toggleExistingPanel(file.element)) {
    return;
  }

  const rawUrl = buildRawUrl({
    owner: context.owner,
    repo: context.repo,
    ref: context.ref,
    path: file.path,
  });

  try {
    const html = await context.fetchHtml(rawUrl);
    const panel = html ? renderIframe(doc, html) : renderMessage(doc, "HTML preview is empty.");
    file.element.appendChild(panel);
  } catch (error: unknown) {
    console.error(error);
    file.element.appendChild(renderMessage(doc, "Could not load HTML preview."));
  }
};

export const ensureHtmlPreviewButtons = (
  doc: Document = document,
  context: HtmlPreviewContext,
): void => {
  ensureHtmlPreviewStyle(doc);

  const previewContext = {
    ...context,
    fetchHtml: context.fetchHtml ?? defaultFetchHtml,
  };

  for (const file of findChangedFiles(doc)) {
    if (!file.path.endsWith(".html")) {
      continue;
    }

    if (file.header.querySelector(`.${HTML_PREVIEW_BUTTON_CLASS}`)) {
      continue;
    }

    const button = doc.createElement("button");
    button.type = "button";
    button.textContent = "Preview HTML";
    button.classList.add("btn", "btn-sm", HTML_PREVIEW_BUTTON_CLASS);
    button.addEventListener("click", () => {
      void loadPreview(doc, file, previewContext);
    });

    file.header.appendChild(button);
  }
};

export const removeHtmlPreviews = (doc: Document = document): void => {
  doc.querySelectorAll(`.${HTML_PREVIEW_BUTTON_CLASS}`).forEach((element) => element.remove());
  doc.querySelectorAll(`.${HTML_PREVIEW_PANEL_CLASS}`).forEach((element) => element.remove());
};
