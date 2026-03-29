<p align="center">
  <img src="icons/app/icon-128.png" alt="Puchne Icon" width="96" />
</p>

# ⚡ Puchne — Ask Every AI at Once

> One prompt. Every AI. Simultaneously.

Puchne is a powerful, open-source Chrome extension that lets you send a single prompt to **ChatGPT, Claude, Gemini, Copilot, DeepSeek, and Perplexity** — all at once. Compare results instantly without manual copy-pasting.

---

## ✨ Features

- **Multicast Prompting** — Type once, blast your query to all selected AI models.
- **Modern Flat Design** — A fast, minimal UI that feels like an integrated command palette.
- **Standardized UI** — Consistent popup dimensions and layout across all websites.
- **Smart Selection** — Toggle specific AIs on/off. ChatGPT, Claude, and Gemini are pre-enabled by default.
- **Prompt History** — Access recent prompts with one click. Clear or hide history based on your preference.
- **Customizable Shortcuts** — Quickly trigger the overlay with `Ctrl+Shift+X` (customizable in Chrome settings).
- **Auto-Submit** — Automatically starts the conversation for you, or just pre-fills the text area.
- **Vertical Positioning** — Fine-tune where the overlay appears on your screen using an intuitive slider.
- **Tab Grouping** — Keeps your workspace organized by grouping all AI tabs automatically.
- **Open Source** — Built with privacy and transparency in mind.

## 🖥️ Supported AI Services

| Service    | URL                   | Status |
| ---------- | --------------------- | ------ |
| ChatGPT    | chatgpt.com           | ✅      |
| Claude     | claude.ai             | ✅      |
| Gemini     | gemini.google.com     | ✅      |
| Copilot    | copilot.microsoft.com | ✅      |
| DeepSeek   | chat.deepseek.com     | ✅      |
| Perplexity | perplexity.ai         | ✅      |

> **Note:** You must be logged into each service for the extension to work. Puchne does not handle authentication.

---

## 📦 Installation

### From Source (Developer Mode)

1. **Clone** this repository:
   ```bash
   git clone https://github.com/arshit09/puchne.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the `puchne` folder

5. Pin the extension icon for the best experience!

### Keyboard Shortcut Setup

1. Go to `chrome://extensions/shortcuts`
2. Find **Puchne**
3. Set your preferred key combination for "Open Puchne popup"

---

## 🏗️ Project Structure

```
puchne/
├── manifest.json              # Extension metadata & permissions
├── scripts/
│   ├── background.js          # Tab orchestration & service registry
│   ├── content.js             # UI Overlay & prompt injection logic
│   ├── constants.js           # Shared constants & service definitions
│   └── cookie-dismiss.js      # Auto-dismiss cookie banners on AI sites
├── pages/
│   ├── popup.html             # Main blast interface
│   ├── popup.js               # Popup logic & event handling
│   ├── options.html           # Settings & customization page
│   ├── options.js             # Options page logic
│   ├── grid.html              # Grid view for comparing AI responses
│   └── grid.js                # Grid view logic
├── styles/
│   ├── popup.css              # Custom themes & layout tokens
│   ├── options.css            # Settings page styling
│   └── grid.css               # Grid view styling
├── rules/
│   └── grid_headers.json      # Declarative net request rules for grid
└── icons/
    ├── chatgpt_dark.png, gemini.png... # Brand icons for services
    └── icon-16.png, icon-48.png, icon-128.png # Extension identity icons
```

---

## 🔧 Technical Overview

Puchne handles the complexities of modern web apps (React/Vue/ProseMirror) by intelligently simulating user input:

- **Bypassing Virtual DOMs:** Uses native prototype hooks to ensure state updates trigger in AI textareas.
- **Event Simulation:** Replicates `InputEvent` and `DataTransfer` to work with advanced editors like ProseMirror (Claude/ChatGPT).
- **Tab Synchronization:** Background workers ensure prompts are only injected once the page is fully ready.

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create.

1. **Bug Reports:** If a service's selector breaks, please open an issue.
2. **New Services:** Add new AI providers to the registry in `scripts/background.js`.
3. **UI Improvements:** Feel free to suggest design refinements.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 🌟 Support

If you like this project, please consider giving it a ⭐ on GitHub! It helps more developers find and improve it.
