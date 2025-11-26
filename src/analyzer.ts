import * as vscode from 'vscode';
import { InteractionEvent } from './tracker';
import { ShortcutsLoader, Shortcut } from './shortcuts-loader';
import { LearnedShortcutsManager } from './learned-shortcuts-manager';

export class Analyzer {
    private lastRecommendationTime: number = 0;
    private cooldownInterval: number;
    private sessionRecommendationLimit: number;
    private shownShortcuts: Set<string> = new Set();

    constructor(
        private shortcutsLoader: ShortcutsLoader,
        private learnedShortcutsManager: LearnedShortcutsManager
    ) {
        const config = vscode.workspace.getConfiguration('shortcutsHelper');
        this.cooldownInterval = config.get<number>('cooldownInterval', 300000);
        this.sessionRecommendationLimit = config.get<number>('sessionRecommendationLimit', 3);
    }

    public async analyzeInteraction(event: InteractionEvent): Promise<void> {
        // Check cooldown
        const now = Date.now();
        if (now - this.lastRecommendationTime < this.cooldownInterval) {
            return;
        }

        // Check session limit
        // If we've reached the limit, we can only show shortcuts we've already shown
        const isSessionLimitReached = this.shownShortcuts.size >= this.sessionRecommendationLimit;

        // Get shortcuts matching this interaction type
        const matchingShortcuts = this.shortcutsLoader.getShortcutsByType(event.type);

        if (matchingShortcuts.length === 0) {
            return;
        }

        // Apply context-specific filtering
        const filteredShortcuts = this.filterByContext(matchingShortcuts, event);

        if (filteredShortcuts.length === 0) {
            return;
        }

        // Filter out learned shortcuts
        const unlearnedShortcuts = filteredShortcuts.filter(
            shortcut => !this.learnedShortcutsManager.isLearned(shortcut.shortcut, shortcut.action)
        );

        if (unlearnedShortcuts.length === 0) {
            return;
        }

        // Apply session limit filtering
        let candidates = unlearnedShortcuts;
        if (isSessionLimitReached) {
            candidates = unlearnedShortcuts.filter(s => this.shownShortcuts.has(this.getShortcutKey(s)));
        }

        if (candidates.length === 0) {
            return;
        }

        // Select the best shortcut to show
        const selectedShortcut = this.selectBestShortcut(candidates, event);

        // Update state BEFORE showing recommendation to prevent race conditions
        this.lastRecommendationTime = now;
        this.shownShortcuts.add(this.getShortcutKey(selectedShortcut));

        // Show recommendation
        await this.showRecommendation(selectedShortcut);
    }

    private filterByContext(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Apply context-specific filtering based on event type
        switch (event.type) {
            case 'activeEditorChange':
                return this.filterActiveEditorChange(shortcuts, event);

            case 'activeTerminalChange':
                return this.filterActiveTerminalChange(shortcuts, event);

            case 'commandExecution':
                return this.filterCommandExecution(shortcuts, event);

            case 'documentClose':
                return this.filterDocumentClose(shortcuts, event);

            case 'fileSave':
                return this.filterFileSave(shortcuts, event);

            case 'intelliSenseTrigger':
                return this.filterIntelliSenseTrigger(shortcuts, event);

            case 'panelVisibilityChange':
                return this.filterPanelVisibilityChange(shortcuts, event);

            case 'peekDefinitionTrigger':
                return this.filterPeekDefinitionTrigger(shortcuts, event);

            case 'quickFixTrigger':
                return this.filterQuickFixTrigger(shortcuts, event);

            case 'referencesTrigger':
                return this.filterReferencesTrigger(shortcuts, event);

            case 'selectionChange':
                return this.filterSelectionChange(shortcuts, event);

            case 'textChange':
                return this.filterTextChange(shortcuts, event);

            case 'windowStateChange':
                return this.filterWindowStateChange(shortcuts, event);

            case 'debugStart':
                return this.filterDebugStart(shortcuts, event);

            case 'debugStop':
                return this.filterDebugStop(shortcuts, event);

            default:
                return shortcuts;
        }
    }

    // ============================================================================
    // Individual Interaction Type Handlers
    // ============================================================================

    private filterActiveEditorChange(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Only recommend if there's an active editor
        if (!event.context?.editor) {
            return [];
        }

        const ctx = event.context;

        // Debug: Show filename information
        console.log('=== DEBUG: Active Editor Change ===');
        console.log('Filename:', ctx.fileName);
        console.log('Language ID:', ctx.languageId);
        console.log('Is Untitled:', ctx.isUntitled);
        console.log('Tab Count Increased:', ctx.tabCountIncreased);
        console.log('Tab Group Count Increased:', ctx.tabGroupCountIncreased);
        console.log('===================================');

        return shortcuts.filter(s => {
            const shortcut = s.shortcut;

            // === GROUP 1: SPLIT EDITOR ===
            if (shortcut.includes('Ctrl+\\')) {
                // Split creates a new editor group
                return ctx.tabGroupCountIncreased;
            }

            // === GROUP 2: NEW FILES ===
            if (shortcut.includes('Ctrl+N')) {
                // New file is untitled - check both isUntitled flag and filename
                const hasUntitledInName = ctx.fileName?.includes('Untitled') ?? false;
                return (ctx.isUntitled || hasUntitledInName) && ctx.tabCountIncreased;
            }

            if (shortcut.includes('Ctrl+O') || shortcut.includes('Ctrl+P')) {
                // Opening file increases tab count but is NOT untitled
                const hasUntitledInName = ctx.fileName?.includes('Untitled') ?? false;
                return !ctx.isUntitled && !hasUntitledInName && ctx.tabCountIncreased;
            }

            if (shortcut.includes('Ctrl+Shift+T')) {
                // Reopen increases tab count
                return ctx.tabCountIncreased;
            }

            // === GROUP 3: NAVIGATION WITHIN TABS ===
            if (shortcut.includes('PageUp') || shortcut.includes('PageDown')) {
                // Navigate within same group, no count changes
                return !ctx.tabCountChanged && !ctx.viewColumnChanged;
            }

            if (shortcut.includes('Ctrl+Tab')) {
                // Navigate through history, might change groups
                return !ctx.tabCountChanged;
            }

            if (shortcut.includes('Alt+') && /Alt\+\d/.test(shortcut)) {
                // Alt+1/2/3 - go to specific tab number
                return !ctx.tabCountChanged && !ctx.viewColumnChanged;
            }

            if (shortcut.includes('Ctrl+1') || shortcut.includes('Ctrl+2') || shortcut.includes('Ctrl+3')) {
                // Focus into specific editor group - viewColumn changes
                return ctx.viewColumnChanged && !ctx.tabCountChanged;
            }

            // === GROUP 4: EDITOR GROUP NAVIGATION ===
            if (shortcut.includes('Ctrl+K Ctrl+←') || shortcut.includes('Ctrl+K Ctrl+→')) {
                // Focus into prev/next group
                return ctx.viewColumnChanged && !ctx.tabCountChanged;
            }

            // === GROUP 5: MOVING EDITORS ===
            if (shortcut.includes('Ctrl+K ←') || shortcut.includes('Ctrl+K →')) {
                // Move editor group - might change group count or order
                return ctx.tabGroupCount > 1;
            }

            if (shortcut.includes('Ctrl+Shift+PgUp') || shortcut.includes('Ctrl+Shift+PgDn')) {
                // Move editor left/right within group
                return !ctx.tabCountChanged;
            }

            // === GROUP 6: PREVIEW MODE ===
            if (shortcut.includes('Ctrl+K Enter')) {
                // Keep preview open - preview becomes non-preview
                return ctx.becameNonPreview;
            }

            // === GROUP 7: MARKDOWN PREVIEW ===
            if (shortcut.includes('Ctrl+K V')) {
                // Open preview to the side - increases groups
                // Check both languageId and filename extension
                const isMarkdown = ctx.languageId === 'markdown' || ctx.fileName?.endsWith('.md') || ctx.fileName?.endsWith('.markdown');
                return isMarkdown && ctx.tabGroupCountIncreased;
            }

            if (shortcut.includes('Ctrl+Shift+V')) {
                // Open preview - might replace current or open new
                // Check both languageId and filename extension
                const isMarkdown = ctx.languageId === 'markdown' || ctx.fileName?.endsWith('.md') || ctx.fileName?.endsWith('.markdown');
                return isMarkdown;
            }

            // === GROUP 8: GO TO DEFINITION ===
            if (shortcut === 'F12') {
                // Go to definition - same document or new
                return true; // Hard to differentiate from other navigation
            }

            if (shortcut.includes('Ctrl+K F12')) {
                // Open definition to side - increases groups
                return ctx.tabGroupCountIncreased;
            }

            // === GROUP 9: LAYOUT CHANGES ===
            if (shortcut.includes('Shift+Alt+0')) {
                // Toggle layout - group count stays same but arrangement changes
                return ctx.tabGroupCount > 1;
            }

            // === GROUP 10: CLOSE ALL ===
            if (shortcut.includes('Ctrl+K Ctrl+W')) {
                // Close all - this actually triggers documentClose, not activeEditorChange
                // But if it does trigger, tab count would decrease dramatically
                return ctx.tabCountInActiveGroup === 0;
            }

            // Default: allow if we can't confidently filter out
            return true;
        });
    }

    private filterActiveTerminalChange(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Only recommend if there's an active terminal
        if (!event.context?.terminal) {
            return [];
        }
        return shortcuts;
    }

    private filterCommandExecution(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Command execution events are generally valid
        // Could add specific command filtering here if needed
        return shortcuts;
    }

    private filterDocumentClose(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Only recommend if a document was actually closed
        if (!event.context?.document) {
            return [];
        }
        return shortcuts;
    }

    private filterFileSave(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Only recommend if a document was actually saved
        if (!event.context?.document) {
            return [];
        }
        return shortcuts;
    }

    private filterIntelliSenseTrigger(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // IntelliSense events are generally valid when triggered
        return shortcuts;
    }

    private filterPanelVisibilityChange(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Panel visibility changes are generally valid
        return shortcuts;
    }

    private filterPeekDefinitionTrigger(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Peek definition events are generally valid when triggered
        return shortcuts;
    }

    private filterQuickFixTrigger(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Quick fix events are generally valid when triggered
        return shortcuts;
    }

    private filterReferencesTrigger(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // References events are generally valid when triggered
        return shortcuts;
    }

    private filterSelectionChange(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Only recommend if there's an active editor and selections
        if (!event.context?.editor || !event.context?.selections) {
            return [];
        }
        return shortcuts;
    }

    private filterTextChange(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Only recommend if there were actual changes
        if (!event.context?.changes || event.context.changes.length === 0) {
            return [];
        }
        return shortcuts;
    }

    private filterWindowStateChange(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Only recommend if the window state actually changed
        if (!event.context?.state) {
            return [];
        }
        return shortcuts;
    }

    private filterDebugStart(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Debug start events are generally valid when triggered
        return shortcuts;
    }

    private filterDebugStop(shortcuts: Shortcut[], event: InteractionEvent): Shortcut[] {
        // Debug stop events are generally valid when triggered
        return shortcuts;
    }

    private selectBestShortcut(shortcuts: Shortcut[], event: InteractionEvent): Shortcut {
        // Prioritize specific shortcuts based on event type
        if (event.type === 'windowStateChange') {
            const altTab = shortcuts.find(s => s.shortcut === 'Alt+Tab');
            if (altTab) {
                return altTab;
            }
        }

        if (event.type === 'activeTerminalChange') {
            const ctrlBacktick = shortcuts.find(s => s.shortcut === 'Ctrl+`');
            if (ctrlBacktick) {
                return ctrlBacktick;
            }
        }

        return this.selectRandomShortcut(shortcuts);
    }

    private selectRandomShortcut(shortcuts: Shortcut[]): Shortcut {
        const randomIndex = Math.floor(Math.random() * shortcuts.length);
        return shortcuts[randomIndex];
    }

    private async showRecommendation(shortcut: Shortcut): Promise<void> {
        const message = `Shortcut Tip: Use ${shortcut.shortcut} to ${this.formatAction(shortcut.action)}`;
        const response = await vscode.window.showInformationMessage(
            message,
            "I got it! Don't show again",
            "OK"
        );

        // If user clicked "I got it!", mark as learned
        if (response === "I got it! Don't show again") {
            await this.learnedShortcutsManager.markAsLearned(shortcut.shortcut, shortcut.action);
        }
    }

    private getShortcutKey(shortcut: Shortcut): string {
        return `${shortcut.shortcut}:${shortcut.action}`;
    }

    private formatAction(action: string): string {
        // Convert action to lowercase and ensure it starts with a verb
        // Remove quotes and newlines for display
        let formatted = action.replace(/"/g, '').replace(/\n/g, ' ').trim();

        // If the action doesn't start with a lowercase letter, make it lowercase
        if (formatted.length > 0 && formatted[0] === formatted[0].toUpperCase()) {
            formatted = formatted[0].toLowerCase() + formatted.slice(1);
        }

        return formatted;
    }
}
