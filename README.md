# Cards View Delete Button — Thunderbird Extension

Adds a 🗑 delete button to each message card in Thunderbird's **Cards View**, so you can delete emails without selecting them first or reaching for the keyboard.

![Cards View Delete Button in action](screenshot.png)

## The problem

Thunderbird's Cards View (the modern card-style message list) has no quick-delete button on each card. You have to first click a card to select it, then press `Delete` or use the toolbar. This extension adds a small trash icon directly on each card.

## Features

- 🗑 Trash icon appears on every card in Cards View
- Click it to instantly move that message to Trash
- Works on any card regardless of which one is currently selected
- Gray by default, turns red on hover

## Requirements

- **Thunderbird 115 or later** (tested on TB 148)
- Cards View enabled (View → Layout → Cards View)

## Installation

> ⚠️ This extension uses Thunderbird's Experiment API, which requires one configuration change before installing.

### Step 1 — Enable Experiment API

1. In Thunderbird, open a new tab and type `about:config` in the address bar
2. Search for `extensions.experiments.enabled`
3. Double-click to set it to **`true`**

### Step 2 — Install the extension

1. Download the latest `cards-delete-btn.xpi` from [Releases](../../releases)
2. In Thunderbird: **Tools → Add-ons and Themes** (or `Ctrl+Shift+A`)
3. Click the gear icon ⚙️ → **Install Add-on From File...**
4. Select the downloaded `.xpi` file
5. Confirm the installation warning (the extension needs elevated privileges to modify Thunderbird's UI)
6. Restart Thunderbird

The trash icon will appear on all cards automatically.

## ⚠️ Compatibility warning

This extension accesses Thunderbird's internal APIs (`gDBView`, `ExtensionSupport`) which are not part of the stable WebExtension API. This means:

- It **may break after a Thunderbird update**
- If the icon stops appearing after an update, check the [Issues](../../issues) page or open a new one

## How it works

The extension injects a button into each `[is='thread-card']` element inside Thunderbird's `about:3pane` sub-document. When clicked, it reads the card's row index from the `gDBView` object and issues a `cmd_delete` command for that specific message — bypassing the need to change the current selection.

## Building from source

```
git clone https://github.com/YOUR_USERNAME/cards-delete-btn
cd cards-delete-btn
zip -r cards-delete-btn.xpi manifest.json background.js api/
```

## License

MIT — do whatever you want with it.

## Contributing

Pull requests welcome. The main area that needs work is making the delete more robust when `gDBView` is not available (e.g. during folder loading).
