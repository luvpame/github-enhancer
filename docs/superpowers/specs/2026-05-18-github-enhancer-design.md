# github-enhancer Design

## Goal

Build `github-enhancer`, a Chrome MV3 extension for GitHub pull request pages.

The extension includes two independently switchable features:

- PR copy buttons, ported from `luvpame/github-pr-copy`
- HTML preview buttons for `.html` files in pull request file changes

The repository is created from `luvpame/browser-extension-template` and keeps the template stack: WXT, TypeScript, React popup, pnpm, Vite+, and mise.

## Repository Setup

The intended repository is `luvpame/github-enhancer`.

Creation flow:

```bash
gh repo create github-enhancer --public --template luvpame/browser-extension-template
ghq get github.com/luvpame/github-enhancer
```

The template uses `browser-extension-template` placeholders initially. Project initialization is implementation work and should run during the implementation plan, not as part of this design-only commit.

## Features

### PR Copy

On GitHub pull request pages, the extension adds compact copy buttons near the PR title:

- `Title`: copies the PR title
- `Url`: copies the current PR URL
- `Textlink`: copies a Markdown link in `[title](url)` form

The behavior should match `luvpame/github-pr-copy` unless the new repository structure requires small naming changes.

The feature is enabled by default and can be disabled from the popup.

### HTML Preview

On a pull request Files changed view, the extension detects changed files whose path ends in `.html`.

For each matching file, it adds a `Preview HTML` button near the file header. The extension does not automatically fetch or render HTML. It fetches the file only after the user clicks the button.

On click, the extension fetches the pull request head-side raw file and renders it in an inline preview panel using a sandboxed iframe.

The preview is intended for quick visual inspection inside the PR page. It is not a full browser or a pixel-perfect deployment preview.

## Architecture

Use one GitHub PR content script that coordinates feature modules:

- `entrypoints/github.content.ts`: registers the content script for GitHub PR pages, observes GitHub DOM updates, responds to SPA navigation, reads settings, and calls feature modules
- `lib/settings.ts`: stores and exposes `prCopyEnabled` and `htmlPreviewEnabled`
- `lib/github-pr-copy.ts`: implements PR title detection and copy buttons
- `lib/github-html-preview.ts`: implements HTML file detection, raw URL resolution, preview button insertion, fetching, and iframe rendering
- `entrypoints/popup/*`: React popup UI for feature toggles

Each module should be independently testable. The content script should be thin coordination code.

## Settings

Settings live in `browser.storage.local`.

Shape:

```ts
export interface EnhancerSettings {
  prCopyEnabled: boolean;
  htmlPreviewEnabled: boolean;
}
```

Default settings:

```ts
export const DEFAULT_SETTINGS: EnhancerSettings = {
  prCopyEnabled: true,
  htmlPreviewEnabled: true,
};
```

The popup presents two toggles:

- PR copy
- HTML preview

There is no global extension on/off switch. If a setting changes while a GitHub PR page is open, the content script should update the page without requiring a reload. Turning a feature off should remove UI inserted by that feature.

## HTML Raw File Resolution

The HTML preview feature should fetch the pull request head-side file content, not reconstruct content from visible diff rows.

Rationale:

- GitHub diffs can omit unchanged sections
- Large diffs may be collapsed or truncated
- Reconstructing modified files from diff DOM adds fragile complexity

The raw URL should use the repository owner, repository name, PR head ref or SHA, and changed file path:

```text
https://raw.githubusercontent.com/{owner}/{repo}/{headRefOrSha}/{path}
```

Resolution order:

1. Use a head commit SHA when GitHub exposes one in the page DOM or metadata.
2. Use the pull request head branch ref when a SHA is not available.
3. If neither value can be resolved, show an error for that file and do not fetch.

If the extension cannot resolve a raw URL reliably, it should show a short error in the preview area and avoid further action for that file.

## HTML Rendering

Render fetched HTML with:

```html
<iframe sandbox srcdoc="..."></iframe>
```

The sandbox must not allow scripts. The initial preview scope does not need form submission, popups, downloads, top navigation, same-origin access, or extension access.

The preview panel should be inserted near the matching file. Re-clicking `Preview HTML` toggles that file's panel open and closed.

The first implementation may render relative assets exactly as the browser resolves them from `srcdoc`, even if some images or styles do not load. Resolving and rewriting relative asset URLs is out of scope for the first version.

## Error Handling

Failures should stay local to the affected feature or file.

PR copy:

- If the PR title cannot be found, do not insert buttons
- If clipboard write fails, log the error and leave the page usable

HTML preview:

- If no `.html` files are present, do nothing
- If the file path or raw URL cannot be resolved, show a short error for that file
- If fetch fails, show a short error for that file
- If the fetched HTML is empty, show a short empty-content message
- If GitHub changes its DOM and selectors fail, the feature should quietly skip insertion instead of throwing uncaught errors

## Testing

Use the existing template test stack with jsdom.

Required tests:

- settings defaults are both enabled
- settings can be saved and loaded
- popup toggles update storage
- PR copy creates `Title`, `Url`, and `Textlink` buttons
- PR copy avoids duplicate button containers
- PR copy removes inserted UI when disabled
- HTML preview inserts a button for `.html` files
- HTML preview does not insert a button for non-HTML files
- HTML preview builds the expected raw URL from GitHub PR context
- HTML preview renders a sandboxed iframe after a successful fetch
- HTML preview displays an error message after a failed fetch
- WXT config includes the GitHub PR content script and popup entrypoint

## Out of Scope

- Full GitHub Markdown-style rendered diff integration
- Automatic preview without a user click
- Rendering non-HTML file types
- Rewriting relative asset URLs inside fetched HTML
- Executing scripts inside previews
- A global extension enable/disable switch
- Cross-browser behavior beyond the Chrome MV3 output already produced by the template

## Implementation Notes

Keep the implementation small and direct:

- Reuse the existing `github-pr-copy` logic where practical
- Prefer focused modules over one large content script
- Do not add backward-compatibility shims
- Do not add fallback paths unless they are simple and reduce user-visible failure
- Avoid broad GitHub API integration unless raw URL resolution cannot be done from page context
