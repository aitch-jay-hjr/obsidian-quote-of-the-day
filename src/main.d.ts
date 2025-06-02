import { Plugin, TFile } from "obsidian";
interface QuotePluginSettings {
    quotesFolder: string;
    apiUrl: string;
}
export default class QuoteOfTheDayPlugin extends Plugin {
    settings: QuotePluginSettings;
    onload(): Promise<void>;
    onunload(): void;
    loadSettings(): Promise<void>;
    saveSettings(): Promise<void>;
    ensureFolder(folderPath: string): Promise<void>;
    getTodayDateStr(): string;
    getTodaysQuoteFile(): TFile | null;
    private performFetch;
    fetchAndSaveQuote(): Promise<void>;
}
export {};
