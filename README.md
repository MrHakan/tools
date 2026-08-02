# Bench

**Small tools that run entirely in your browser.** No accounts, no uploads, no build step.

→ **[mrhakan.github.io/tools](https://mrhakan.github.io/tools/)**

Each tool does one thing. Open the page, paste something in, get something out. Nothing you type or open ever leaves the tab — there is no server to send it to. Once the page has loaded it keeps working offline.

## Status

**19 of a planned 59 tools are built and working.** The hub shows the full set: finished tools are live links, the rest render as dashed "building" cards so the shape of the collection stays legible. Nothing links to a page that doesn't exist.

Built so far: Kanban board · diff checker · JSON formatter · regex tester · encoder & hasher · JWT decoder · ID generator · text case converter · HTML entity converter · cron explainer · CSS generator · palette extractor · favicon generator · Markdown editor · text analyser · word counter · QR code studio · HTTP status codes · whiteboard

## The full plan

| Group | Tools |
| --- | --- |
| **Productivity** | Kanban board, Pomodoro timer, habit tracker, résumé builder, expense splitter, budget tracker, contact tracker, time zone finder, shortcut cheat sheet |
| **Developer utilities** | Diff checker, JSON formatter, regex tester, encoder & hasher, CSV viewer, SQL formatter, config converter, JWT decoder, ID generator, timestamp converter, base converter, case converter, .gitignore generator, license picker, .env builder, rate limit calculator, mock API designer, SemVer calculator, patch generator, word-level diff, HTML entity converter |
| **Cron & scheduling** | Cron explainer, cron calendar |
| **Design & CSS** | CSS generator, contrast checker, palette extractor, clamp calculator, aspect ratio calculator, favicon generator, placeholder image |
| **Content & text** | Markdown editor, Markdown table builder, README badge builder, text analyser, word counter, keyword highlighter, placeholder data, random generators |
| **Media & misc** | Image editor, QR code studio, image ⇄ base64, meta tag preview, password strength, encrypted vault, HTTP status codes, git cheat sheet, whiteboard, link keeper, game corner |
| **Pattern toolbox** | Cron, regex and glob in one workspace |

## Running it locally

There is no toolchain. Serve the folder and open it:

```sh
git clone https://github.com/MrHakan/tools.git
cd tools
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

Opening `index.html` straight off the filesystem mostly works too, but a few tools that read files behave better over `http://`.

## How it's built

Vanilla HTML, CSS and JavaScript. No framework, no bundler, no runtime dependencies.

```
index.html                 the hub, with live search across all 59 tools
assets/css/bench.css       design tokens and shared components
assets/js/bench.js         shared runtime — clipboard, storage, files, toasts
assets/js/tools.js         the tool registry that drives the hub
assets/fonts/              self-hosted woff2 subsets
tools/<slug>/index.html    one self-contained page per tool
```

Every tool page is a single file that pulls in `bench.css` and `bench.js` and nothing else. Fonts are served from this origin rather than a CDN, so visiting a page makes no third-party requests at all.

### Adding a tool

1. Create `tools/<slug>/index.html`, copying the structure of an existing tool.
2. Add an entry to `assets/js/tools.js` — the hub and its search build themselves from that list.

The `spec` field on each registry entry is the specimen shown on the card: a literal fragment of the data that tool works with (`*/5 * * * *`, `eyJhbGciOi`, `4.5 : 1 AA`). It's what makes the grid scannable by shape instead of by reading every title.

## Keyboard

On the hub, `/` focuses the search box and `Enter` opens the top match. `Esc` clears it.

## Notes on the security tools

The encrypted vault uses the browser's own WebCrypto — AES-GCM with a PBKDF2-derived key — and keeps the ciphertext in `localStorage`. It's a solid demonstration of the primitives, but it inherits the limits of any browser-stored secret: clearing site data destroys the vault, and it offers no protection against malware on the machine. Export a backup, and prefer a dedicated password manager for anything that matters.

## Licence

[MIT](LICENSE)
