# Github Enhancer

WXT-based Chrome extension that enhances GitHub repository and pull request pages.

## Features

- Adds `Title`, `Url`, and `Textlink` copy buttons to pull request titles
- Adds `Preview HTML` buttons for changed `.html` files in pull requests
- Adds DeepWiki, Devin Wiki, and Devin Review shortcuts to repository pages
- Provides popup toggles for PR copy, HTML preview, and Devin redirect
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
