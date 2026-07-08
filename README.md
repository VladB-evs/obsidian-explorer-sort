# Explorer Sort

An Obsidian plugin that lets you **manually arrange files and folders** in the file explorer, giving each folder its own custom order instead of the built-in alphabetical/date sorting.

## Features

- **Per-folder custom order** — every folder (including the vault root) can have its own arrangement. Folders without a custom order keep Obsidian's default sorting.
- **Right-click to move** — the file explorer context menu gains *Move up*, *Move down*, *Move to top*, and *Move to bottom*.
- **Drag-and-drop reordering** — *Reorder folder contents…* opens a modal where you drag items into place (with up/down buttons as a fallback), then save.
- **Commands & hotkeys** — move the active file up/down/top/bottom or open the reorder modal from the command palette; bind hotkeys to any of them.
- **Survives renames and moves** — custom orders are updated automatically when you rename, move, or delete files and folders.
- **New files land at the bottom** — items without a saved position are appended after the custom-ordered ones, in Obsidian's default order.
- **Toggle on/off** — disable custom sorting at any time from settings or via the *Toggle custom sorting* command; your saved orders are kept.

## Installation (manual)

1. Build the plugin (see below) or grab `main.js`, `manifest.json`, and `styles.css`.
2. Create the folder `<your vault>/.obsidian/plugins/explorer-sort/`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
4. In Obsidian, go to **Settings → Community plugins**, refresh the list, and enable **Explorer Sort**.

## Building from source

```bash
npm install
npm run build   # produces main.js
```

For development with automatic rebuilds:

```bash
npm run dev
```

## Usage

1. Right-click any file or folder in the file explorer.
2. Use *Move up / Move down / Move to top / Move to bottom* for quick adjustments, or *Reorder folder contents…* to drag everything into place at once.
3. To go back to Obsidian's default sorting for a folder, open the reorder modal and click *Reset to default sorting* — or clear everything from the plugin settings.

## How it works

The plugin wraps the file explorer's internal sorting function. When a folder has a saved order, its children are displayed in that order; the order itself is stored in the plugin's `data.json` as a list of item names per folder path. Because it hooks sorting rather than the DOM, it plays nicely with collapsing/expanding folders and vault changes.

> **Note:** this relies on an internal (non-public) Obsidian API, as all custom-sorting plugins do. If a future Obsidian update changes the explorer internals, the plugin will log a warning and fall back to default sorting rather than break your vault.

## License

MIT
