import {
  App,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  MarkdownRenderer,
  Component,
} from "obsidian";

// ─────────────────────────────────────────────────────────────
// 1. Define plugin settings
// ─────────────────────────────────────────────────────────────

interface QuotePluginSettings {
  quotesFolder: string; // vault-relative path, e.g. "05_references/Quotes"
  apiUrl: string;       // e.g. "https://thequoteshub.com/api/random"
}

const DEFAULT_SETTINGS: QuotePluginSettings = {
  quotesFolder: "05_references/Quotes",
  apiUrl: "https://thequoteshub.com/api/random",
};

// ─────────────────────────────────────────────────────────────
// ERROR DISPLAY MODAL
// ─────────────────────────────────────────────────────────────

class ErrorDisplayModal extends Modal {
  titleText: string;
  bodyText: string;

  constructor(app: App, title: string, body: string) {
    super(app);
    this.titleText = title;
    this.bodyText = body;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.titleText });
    const container = contentEl.createEl("div", { cls: "qotd-error-body" });
    container.createEl("pre", {
      text: this.bodyText,
      cls: "qotd-error-pre",
    });
    contentEl.createEl("p", {
      text: "You can copy this information for reporting.",
      cls: "qotd-error-copy-note",
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Rating Modal (displays quote before rating)
// ─────────────────────────────────────────────────────────────

class RateQuoteModal extends Modal {
  plugin: QuoteOfTheDayPlugin;
  quoteFile: TFile;

  constructor(app: App, plugin: QuoteOfTheDayPlugin, file: TFile) {
    super(app);
    this.plugin = plugin;
    this.quoteFile = file;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    // 1) Read the file’s contents
    const fileContent = await this.app.vault.read(this.quoteFile);

    // 2) Parse frontmatter to extract quote and author
    const parts = fileContent.split("---\n");
    let quoteText = "";
    let quoteAuthor = "";
    if (parts.length >= 3) {
      const yamlLines = parts[1].split("\n");
      for (const line of yamlLines) {
        if (line.startsWith("quote:")) {
          quoteText = line.replace(/^quote:\s*"/, "").replace(/"$/, "");
        } else if (line.startsWith("author:")) {
          quoteAuthor = line.replace(/^author:\s*"/, "").replace(/"$/, "");
        }
      }
    }

    contentEl.createEl("h2", { text: "Rate This Quote" });
    contentEl.createEl("blockquote", {
      text: quoteText,
      cls: "qotd-blockquote",
    });
    contentEl.createEl("p", {
      text: `— ${quoteAuthor}`,
      cls: "qotd-author",
    });

    contentEl.createEl("hr");

    // 3) Render numerical rating fields
    let inspiration: number = 0;
    let wisdom: number = 0;
    let style: number = 0;

    new Setting(contentEl)
      .setName("Inspiration (1–5)")
      .addText((text) =>
        text
          .setPlaceholder("e.g. 4")
          .onChange((value: string) => {
            inspiration = Number(value);
          })
      );

    new Setting(contentEl)
      .setName("Wisdom (1–5)")
      .addText((text) =>
        text
          .setPlaceholder("e.g. 5")
          .onChange((value: string) => {
            wisdom = Number(value);
          })
      );

    new Setting(contentEl)
      .setName("Style (1–5)")
      .addText((text) =>
        text
          .setPlaceholder("e.g. 3")
          .onChange((value: string) => {
            style = Number(value);
          })
      );

    new Setting(contentEl).setName("Save Ratings").addButton((btn) =>
      btn
        .setButtonText("Save")
        .setCta()
        .onClick(async () => {
          const updatedContent = await this.app.vault.read(this.quoteFile);
          const parts2 = updatedContent.split("---\n");
          if (parts2.length < 3) {
            new Notice("Unexpected file format (no frontmatter).");
            this.close();
            return;
          }

          const yamlLines2 = parts2[1].split("\n").map((l) => l.trim());
          const updatedYaml: Set<string> = new Set();
          for (const line of yamlLines2) {
            if (line.startsWith("inspiration:")) continue;
            if (line.startsWith("wisdom:")) continue;
            if (line.startsWith("style:")) continue;
            updatedYaml.add(line);
          }

          updatedYaml.add(`inspiration: ${inspiration}`);
          updatedYaml.add(`wisdom: ${wisdom}`);
          updatedYaml.add(`style: ${style}`);

          const newYaml = Array.from(updatedYaml).join("\n");
          const newFrontmatter = `---\n${newYaml}\n---\n`;
          const body = parts2.slice(2).join("---\n");
          const finalText = newFrontmatter + body;

          await this.app.vault.modify(this.quoteFile, finalText);
          new Notice("Quote ratings saved!");
          this.close();
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ─────────────────────────────────────────────────────────────
// 2a. Settings Tab for folder & API URL
// ─────────────────────────────────────────────────────────────

class QuoteSettingTab extends PluginSettingTab {
  plugin: QuoteOfTheDayPlugin;

  constructor(app: App, plugin: QuoteOfTheDayPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Quote of the Day Settings" });

    new Setting(containerEl)
      .setName("Folder for quote files")
      .setDesc(
        'Vault-relative path (e.g. "05_references/Quotes"). Plugin will create this folder if it doesn’t already exist.'
      )
      .addText((text) =>
        text
          .setPlaceholder("05_references/Quotes")
          .setValue(this.plugin.settings.quotesFolder)
          .onChange(async (value: string) => {
            const folder = value.trim().replace(/^\/+|\/+$/g, "");
            this.plugin.settings.quotesFolder = folder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Quote API URL")
      .setDesc("Example: https://thequoteshub.com/api/random")
      .addText((text) =>
        text
          .setPlaceholder("https://thequoteshub.com/api/random")
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value: string) => {
            this.plugin.settings.apiUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );
  }
}

// ─────────────────────────────────────────────────────────────
// 2b. “Browse Past Quotes” Modal
// ─────────────────────────────────────────────────────────────

class BrowseQuotesModal extends Modal {
  plugin: QuoteOfTheDayPlugin;

  constructor(app: App, plugin: QuoteOfTheDayPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Browse Saved Quotes" });
    contentEl.createEl("p", { text: "Click a quote to open its file." });

    // 1) Find all files in the quotes folder
    const folder = this.plugin.settings.quotesFolder;
    const allFiles = this.plugin.app.vault.getFiles().filter((f) =>
      f.path.startsWith(folder + "/")
    );

    if (allFiles.length === 0) {
      contentEl.createEl("p", {
        text: "No saved quotes found.",
        cls: "qotd-no-results",
      });
      return;
    }

    // 2) Create a scrollable container
    const listEl = contentEl.createEl("div", { cls: "qotd-list-container" });
    listEl.style.maxHeight = "400px";
    listEl.style.overflowY = "auto";

    // 3) For each file, read frontmatter and render a clickable entry
    for (const file of allFiles) {
      const fileContent = await this.app.vault.read(file);
      const parts = fileContent.split("---\n");
      let quoteText = "";
      let quoteAuthor = "";
      if (parts.length >= 3) {
        const yamlLines = parts[1].split("\n");
        for (const line of yamlLines) {
          if (line.startsWith("quote:")) {
            quoteText = line.replace(/^quote:\s*"/, "").replace(/"$/, "");
          } else if (line.startsWith("author:")) {
            quoteAuthor = line.replace(/^author:\s*"/, "").replace(/"$/, "");
          }
        }
      }

      const entry = listEl.createEl("div", { cls: "qotd-entry" });
      entry.style.padding = "8px";
      entry.style.borderBottom = "1px solid var(--edge)";
      entry.style.cursor = "pointer";

      entry.createEl("strong", { text: file.name.replace(".md", "") });
      entry.createEl("div", {
        text: `${quoteText.slice(0, 60)}… — ${quoteAuthor}`,
        cls: "qotd-entry-text",
      });

      entry.onclick = () => {
        this.plugin.app.workspace.openLinkText(file.path, "", false);
        this.close();
      };
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Main Plugin Class
// ─────────────────────────────────────────────────────────────

export default class QuoteOfTheDayPlugin extends Plugin {
  settings!: QuotePluginSettings;

  async onload() {
    await this.loadSettings();

    // Ensure the chosen folder exists on startup
    await this.ensureFolder(this.settings.quotesFolder);

    // Automatically fetch a quote if none exists today
    if (!this.getTodaysQuoteFile()) {
      await this.performFetch();
    }

    // Command: Fetch / Refresh Quote of the Day
    this.addCommand({
      id: "fetch-quote-of-the-day",
      name: "Fetch / Refresh Quote of the Day",
      callback: async () => {
        if (!this.getTodaysQuoteFile()) {
          await this.performFetch();
        } else {
          new Notice(
            "Quote for today already exists. Use 'Fetch Alternative Quote' to get a different one."
          );
        }
      },
    });

    // Command: Fetch Alternative Quote of the Day
    this.addCommand({
      id: "fetch-alternative-quote",
      name: "Fetch Alternative Quote of the Day",
      callback: async () => {
        await this.performFetch();
      },
    });

    // Command: Rate Current Quote
    this.addCommand({
      id: "rate-quote-of-the-day",
      name: "Rate Current Quote",
      callback: async () => {
        const todayFile = this.getTodaysQuoteFile();
        if (!todayFile) {
          new Notice("No quote file found for today. Please fetch it first.");
          return;
        }
        new RateQuoteModal(this.app, this, todayFile).open();
      },
    });

    // Command: Insert Quote of the Day into current note
    this.addCommand({
      id: "insert-quote-of-the-day",
      name: "Insert Quote of the Day",
      callback: async () => {
        const quoteFile = this.getTodaysQuoteFile();
        if (!quoteFile) {
          new Notice("No quote for today exists. Please fetch it first.");
          return;
        }
        const fileContent = await this.app.vault.read(quoteFile);
        const parts = fileContent.split("---\n");
        let quoteText = "";
        let quoteAuthor = "";
        if (parts.length >= 3) {
          const yamlLines = parts[1].split("\n");
          for (const line of yamlLines) {
            if (line.startsWith("quote:")) {
              quoteText = line.replace(/^quote:\s*"/, "").replace(/"$/, "");
            } else if (line.startsWith("author:")) {
              quoteAuthor = line.replace(/^author:\s*"/, "").replace(/"$/, "");
            }
          }
        }
        const markdownInsert = `> ${quoteText}\n>\n> — ${quoteAuthor}\n\n`;
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          const editor = view.editor;
          editor.replaceSelection(markdownInsert);
        } else {
          new Notice("No active editor to insert into.");
        }
      },
    });

    // Command: Copy QotD Snippet to Clipboard
    this.addCommand({
      id: "copy-qotd-snippet",
      name: "Copy QotD Snippet",
      callback: async () => {
        const snippet = "```qotd\n```";
        try {
          await navigator.clipboard.writeText(snippet);
          new Notice("Copied QotD snippet to clipboard.");
        } catch (e) {
          console.error(e);
          new Notice("Failed to copy snippet. Try again.");
        }
      },
    });

    // Command: Browse Saved Quotes
    this.addCommand({
      id: "browse-saved-quotes",
      name: "Browse Saved Quotes",
      callback: () => {
        new BrowseQuotesModal(this.app, this).open();
      },
    });

    // Ribbon icon: Fetch Alternative Quote
    this.addRibbonIcon("star", "Fetch Alternative Quote", async () => {
      await this.performFetch();
    });

    // Status bar item
    this.addStatusBarItem().setText("QOTD ready");

    // Register Markdown code block processor for `qotd`
    this.registerMarkdownCodeBlockProcessor("qotd", async (source, el) => {
      const quoteFile = this.getTodaysQuoteFile();
      if (!quoteFile) {
        el.createEl("p", {
          text: "No Quote of the Day available. Fetch one first.",
        });
        return;
      }
      const fileContent = await this.app.vault.read(quoteFile);
      const parts = fileContent.split("---\n");
      let quoteText = "";
      let quoteAuthor = "";
      if (parts.length >= 3) {
        const yamlLines = parts[1].split("\n");
        for (const line of yamlLines) {
          if (line.startsWith("quote:")) {
            quoteText = line.replace(/^quote:\s*"/, "").replace(/"$/, "");
          } else if (line.startsWith("author:")) {
            quoteAuthor = line.replace(/^author:\s*"/, "").replace(/"$/, "");
          }
        }
      }
      const wrapper = el.createEl("div");
      await MarkdownRenderer.renderMarkdown(
        `> ${quoteText}\n>\n> — ${quoteAuthor}`,
        wrapper,
        quoteFile.path,
        this as unknown as Component
      );
    });

    // Register the Settings Tab
    this.addSettingTab(new QuoteSettingTab(this.app, this));
  }

  onunload() {
    // No teardown needed
  }

  // ─────────────────────────────────────────────────────────────
  // Load & Save Settings
  // ─────────────────────────────────────────────────────────────

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ─────────────────────────────────────────────────────────────
  // Ensure any nested folder path exists
  // ─────────────────────────────────────────────────────────────

  async ensureFolder(folderPath: string) {
    const segments = folderPath.split("/").filter((s) => s.trim().length > 0);
    if (segments.length === 0) return;

    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(currentPath)) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Get “YYYY-MM-DD” string for today
  // ─────────────────────────────────────────────────────────────

  getTodayDateStr(): string {
    const now = new Date();
    const year = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const da = String(now.getDate()).padStart(2, "0");
    return `${year}-${mo}-${da}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Locate today’s quote file (if it exists) by prefix match
  // ─────────────────────────────────────────────────────────────

  getTodaysQuoteFile(): TFile | null {
    const dateStr = this.getTodayDateStr();
    const folder = this.settings.quotesFolder;
    const files = this.app.vault.getFiles();
    const prefix = `${folder}/${dateStr}-`;
    const match = files.find((f) => f.path.startsWith(prefix));
    return match || null;
  }

  // ─────────────────────────────────────────────────────────────
  // Core fetch logic (always fetches a quote)
  // ─────────────────────────────────────────────────────────────

  private async performFetch() {
    const dateStr = this.getTodayDateStr();

    // Ensure the user-chosen folder exists right now
    await this.ensureFolder(this.settings.quotesFolder);

    try {
      const response = await fetch(this.settings.apiUrl);
      if (!response.ok) {
        // Non-200 status: show status code and API URL hint
        new Notice(
          `❌ Quote API returned status ${response.status}. Check your API URL in Settings.`
        );
        return;
      }

      // Attempt to parse JSON; if invalid, show raw text in modal
      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        const raw = await response.text();
        new ErrorDisplayModal(
          this.app,
          "Failed to parse JSON from Quote API",
          raw
        ).open();
        return;
      }

      // Validate expected fields (using data.text, data.author, data.id/_id)
      const hasText = typeof data.text === "string";
      const hasAuthor = typeof data.author === "string";
      const hasId = typeof data.id === "number" || typeof data._id === "string";

      if (!hasText || !hasAuthor || !hasId) {
        // Unexpected JSON structure: show raw JSON in modal
        const pretty = JSON.stringify(data, null, 2);
        new ErrorDisplayModal(
          this.app,
          "Quote API returned unexpected JSON",
          pretty
        ).open();
        return;
      }

      const quoteText = data.text.trim();
      const quoteAuthor = data.author.trim();
      const rawId = data.id ?? data._id;
      const quoteId = String(rawId).trim();

      const slug = quoteText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30);

      const filename = `${dateStr}-${quoteId}-${slug}.md`;
      const filePath = `${this.settings.quotesFolder}/${filename}`;

      const frontmatter = `---
quote: "${quoteText.replace(/"/g, '\\"')}"
author: "${quoteAuthor.replace(/"/g, '\\"')}"
date_added: ${dateStr}
inspiration:
wisdom:
style:
---
`;

      await this.app.vault.create(filePath, frontmatter);
      new Notice(`✅ Created new quote: ${filename}`);

      // Immediately show the fetched quote in a Notice (short preview)
      new Notice(`Today's Quote:\n"${quoteText}" — ${quoteAuthor}`);
    } catch (err: any) {
      // Network or other fetch error
      if (err.name === "TypeError") {
        new Notice(
          "❌ Network error while fetching quote. Are you offline?"
        );
      } else {
        console.error(err);
        new Notice(`❌ Error fetching quote: ${err.message || err}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Wrapper for initial fetch: only if no quote exists today
  // ─────────────────────────────────────────────────────────────

  async fetchAndSaveQuote() {
    if (!this.getTodaysQuoteFile()) {
      await this.performFetch();
    }
  }
}
