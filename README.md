# Obsidian Quote of the Day

**A lightweight Obsidian plugin** that fetches a daily quote, lets you rate it, browses saved quotes, and dynamically renders today’s quote via a `qotd` code block.

## Installation

### From GitHub (Dev build)
1. Clone or download this repo.
2. Run `npm install` then `npm run build`.
3. Copy `manifest.json`, `main.js`, and `styles.css` into
   your vault’s `.obsidian/plugins/obsidian-quote-of-the-day/`.
4. Reload Obsidian and enable “Quote of the Day” in Settings → Community Plugins.

### From Community Plugins (once published)
1. Go to Settings → Community Plugins → Browse.
2. Search “Quote of the Day” and click Install.

## Usage

1. On vault-open (once per calendar day), the plugin auto-fetches a quote in your chosen folder (default: `05_references/Quotes/`).
2. Commands you can run via **⌘P**:
   - **“Fetch / Refresh Quote of the Day”** (only if none exists today)
   - **“Fetch Alternative Quote of the Day”** (always fetch a fresh quote)
   - **“Rate Current Quote”** (opens a modal to rate Inspiration / Wisdom / Style)
   - **“Browse Saved Quotes”** (scrollable list of all past quotes; click to open)
   - **“Copy QotD Snippet”** (copies three-line code block for embedding)
   - **“Insert Quote of the Day”** (pastes today’s quote at cursor)
3. Drop a code block in any note:
   - Obsidian will render the current day’s quote automatically.

## Contributing

1. Fork or clone this repository.
2. Create a new branch (`git checkout -b feat/my-feature`).
3. Make your changes and commit (`git commit -m "Add …"`).
4. Push to your fork and open a Pull Request.

## License

MIT © 2025 Harry Rose
```


