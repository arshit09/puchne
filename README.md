<p align="center">
  <img src="icons/app/icon-128.png" alt="Puchne Icon" width="96" />
</p>

# Puchne — Ask Every AI at Once

> **One prompt. Every AI. Simultaneously.**

**Puchne** (derived from the Gujarati word **'પૂછવું'** (*Puchhvu*), meaning **"to ask"**) is a lightweight, open-source Chrome extension that broadcasts a single prompt to multiple AI services at the same time. 

*   **For Everyone:** Type your question once and watch it automatically load in ChatGPT, Claude, Gemini, Copilot, DeepSeek, and Perplexity. No more copy-pasting across different tabs!
*   **For Developers:** A clean extension built with Manifest V3 that simulates native input events and uses DOM prototype overrides to reliably bypass virtual DOM state-tracking in modern framework-based text areas (React, Vue, ProseMirror).

---

## 🌟 Key Features

*   **Multicast Prompting:** Input one prompt and blast it to all selected AI models at once.
*   **Dual Display Modes:**
    *   **Grid View:** Compare all AI responses side-by-side in real-time within a single tab.
    *   **Tab Grouping:** Auto-organize independent service tabs into a neat Chrome Tab Group.
*   **Unified Controls:** Easily customize which AI models are active, access recent prompts, or clear history.
*   **Global Shortcut:** Instantly summon the Puchne query overlay from any webpage using `Ctrl+Shift+X`.
*   **Intelligent Injector:** Seamlessly handles iframe cookie consent popups and manages site authentication automatically.

---

## ⚙️ Customization Settings

Puchne features a highly customizable settings panel grouped into intuitive sections:

### 1. AI Tools
*   **Select Providers:** Toggle which models (ChatGPT, Claude, Gemini, Copilot, DeepSeek, Perplexity) are active.

### 2. Appearance
*   **Theme:** Switch between Light Mode and Dark Mode.
*   **Layout Options:** Floating Overlay (Top, Center, Bottom of screen) or Docked Sidebar.
*   **UI Details:** Custom AI chips display (logos only, names only, or both) and keyboard shortcut hint toggle.

### 3. Behavior & Automation
*   **Auto-Submit:** Automate sending prompts (simulates pressing "Enter" after injecting) or just pre-fill input textareas.
*   **Page Load Delay:** Set custom delays (in ms) to wait for slower pages to load before injecting.
*   **Cookie Consent:** Set auto-handling behavior for iframe cookie banners (Accept All, Reject All, or Off).
*   **Hover to Expand:** Customize hover enlargement behavior for Grid View cells (delay from instant to 2 seconds, activation count threshold).
*   **Prompt History:** Toggle history saving and customize the limit (from 5 to 100 stored prompts).

---

## 🚀 Getting Started (Developer Mode)

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/arshit09/puchne.git
    ```
2.  **Install in Chrome:**
    *   Go to `chrome://extensions/`
    *   Turn on **Developer mode** (top-right toggle).
    *   Click **Load unpacked** and select the root directory of the cloned project.
3.  **Set Up Shortcut:** Go to `chrome://extensions/shortcuts` to customize the shortcut key if desired.

---

## 📝 License & Contributing

*   Distributed under the **MIT License**. See `LICENSE` for details.
*   Contributions (bug reports, selectors updates, UI refinements) are welcome!

---

## 📋 ToDo

*   **Feedback Feature:** A simple input field to take user input from the extension itself quickly and show it in a Google Sheet easily to simplify the feedback iteration loop.
