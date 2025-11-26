import * as vscode from 'vscode';

/**
 * Manages the list of shortcuts that the user has marked as learned.
 * Uses VS Code's globalState API for persistent storage across sessions.
 */
export class LearnedShortcutsManager {
    private static readonly STORAGE_KEY = 'learnedShortcuts';
    private learnedShortcuts: Set<string>;

    constructor(private globalState: vscode.Memento) {
        // Load learned shortcuts from storage
        const stored = this.globalState.get<string[]>(LearnedShortcutsManager.STORAGE_KEY, []);
        this.learnedShortcuts = new Set(stored);
    }

    /**
     * Creates a unique identifier for a shortcut based on its key and action.
     */
    private getShortcutId(shortcut: string, action: string): string {
        return `${shortcut}|${action}`;
    }

    /**
     * Checks if a shortcut has been marked as learned.
     */
    public isLearned(shortcut: string, action: string): boolean {
        const id = this.getShortcutId(shortcut, action);
        return this.learnedShortcuts.has(id);
    }

    /**
     * Marks a shortcut as learned and persists to storage.
     */
    public async markAsLearned(shortcut: string, action: string): Promise<void> {
        const id = this.getShortcutId(shortcut, action);
        this.learnedShortcuts.add(id);

        // Persist to storage
        await this.save();
    }

    /**
     * Gets all learned shortcut identifiers.
     */
    public getAllLearned(): string[] {
        return Array.from(this.learnedShortcuts);
    }

    /**
     * Gets all learned shortcuts with parsed details.
     * Returns an array of {shortcut, action} objects.
     */
    public getLearnedShortcutsDetails(): Array<{ shortcut: string, action: string }> {
        return Array.from(this.learnedShortcuts).map(id => {
            const [shortcut, action] = id.split('|');
            return { shortcut, action };
        });
    }

    /**
     * Unlearns a specific shortcut (removes it from learned list).
     */
    public async unlearn(shortcut: string, action: string): Promise<void> {
        const id = this.getShortcutId(shortcut, action);
        this.learnedShortcuts.delete(id);
        await this.save();
    }

    /**
     * Clears all learned shortcuts (useful for testing/reset).
     */
    public async clearAll(): Promise<void> {
        this.learnedShortcuts.clear();
        await this.save();
    }

    /**
     * Saves the current state to persistent storage.
     */
    private async save(): Promise<void> {
        const array = Array.from(this.learnedShortcuts);
        await this.globalState.update(LearnedShortcutsManager.STORAGE_KEY, array);
    }
}
