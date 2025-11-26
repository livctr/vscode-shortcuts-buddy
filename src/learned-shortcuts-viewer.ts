import * as vscode from 'vscode';
import { LearnedShortcutsManager } from './learned-shortcuts-manager';

/**
 * Manages the webview panel for viewing and managing learned shortcuts.
 */
export class LearnedShortcutsViewer {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private learnedShortcutsManager: LearnedShortcutsManager
    ) { }

    /**
     * Shows the learned shortcuts viewer panel.
     */
    public show(): void {
        if (this.panel) {
            // If panel already exists, reveal it
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            // Create new panel
            this.panel = vscode.window.createWebviewPanel(
                'learnedShortcuts',
                'Learned Shortcuts',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            // Set initial content
            this.updateContent();

            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'unlearn':
                            await this.handleUnlearn(message.shortcut, message.action);
                            break;
                        case 'unlearnAll':
                            await this.handleUnlearnAll();
                            break;
                    }
                },
                undefined,
                this.context.subscriptions
            );

            // Clean up when panel is closed
            this.panel.onDidDispose(
                () => {
                    this.panel = undefined;
                },
                undefined,
                this.context.subscriptions
            );
        }
    }

    /**
     * Handles unlearning a single shortcut.
     */
    private async handleUnlearn(shortcut: string, action: string): Promise<void> {
        await this.learnedShortcutsManager.unlearn(shortcut, action);
        this.updateContent();
        vscode.window.showInformationMessage(`Unlearned: ${shortcut}`);
    }

    /**
     * Handles unlearning all shortcuts with confirmation.
     */
    private async handleUnlearnAll(): Promise<void> {
        const confirmation = await vscode.window.showWarningMessage(
            'Are you sure you want to unlearn all shortcuts? This will reset your learning progress.',
            { modal: true },
            'Yes, Unlearn All',
            'Cancel'
        );

        if (confirmation === 'Yes, Unlearn All') {
            await this.learnedShortcutsManager.clearAll();
            this.updateContent();
            vscode.window.showInformationMessage('All shortcuts have been unlearned.');
        }
    }

    /**
     * Updates the webview content with current learned shortcuts.
     */
    private updateContent(): void {
        if (!this.panel) {
            return;
        }

        const shortcuts = this.learnedShortcutsManager.getLearnedShortcutsDetails();
        this.panel.webview.html = this.getHtmlContent(shortcuts);
    }

    /**
     * Generates the HTML content for the webview.
     */
    private getHtmlContent(shortcuts: Array<{ shortcut: string, action: string }>): string {
        const shortcutsHtml = shortcuts.length === 0
            ? '<p class="empty-state">No learned shortcuts yet. Mark shortcuts as learned to see them here.</p>'
            : shortcuts.map((s, index) => `
                <div class="shortcut-item">
                    <input type="checkbox" id="shortcut-${index}" class="shortcut-checkbox" 
                           data-shortcut="${this.escapeHtml(s.shortcut)}" 
                           data-action="${this.escapeHtml(s.action)}">
                    <label for="shortcut-${index}">
                        <span class="shortcut-key">${this.escapeHtml(s.shortcut)}</span>
                        <span class="shortcut-action">${this.escapeHtml(s.action)}</span>
                    </label>
                </div>
            `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Learned Shortcuts</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .subtitle {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 20px;
        }
        
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            align-items: center;
        }
        
        .select-all-container {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 13px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .shortcuts-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .shortcut-item {
            display: flex;
            align-items: flex-start;
            padding: 12px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .shortcut-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .shortcut-checkbox {
            margin-top: 2px;
            margin-right: 10px;
            cursor: pointer;
        }
        
        label {
            display: flex;
            flex-direction: column;
            gap: 4px;
            cursor: pointer;
            flex: 1;
        }
        
        .shortcut-key {
            font-family: var(--vscode-editor-font-family);
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            font-size: 14px;
        }
        
        .shortcut-action {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }
        
        .empty-state {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 40px 20px;
            font-style: italic;
        }
        
        .count {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }

        .search-container {
            margin-bottom: 15px;
        }

        #search-input {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            box-sizing: border-box;
        }

        #search-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <h1>Learned Shortcuts</h1>
    <p class="subtitle">Manage shortcuts you've marked as learned. Unlearn shortcuts to see them in recommendations again.</p>
    
    <div class="search-container">
        <input type="text" id="search-input" placeholder="Search shortcuts or actions...">
    </div>
    
    ${shortcuts.length > 0 ? `
    <div class="controls">
        <div class="select-all-container">
            <input type="checkbox" id="select-all">
            <label for="select-all">Select All</label>
        </div>
        <button id="unlearn-selected" disabled>Unlearn Selected</button>
        <span class="count">(${shortcuts.length} learned)</span>
    </div>
    ` : ''}
    
    <div class="shortcuts-list">
        ${shortcutsHtml}
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Get all checkboxes
        const selectAllCheckbox = document.getElementById('select-all');
        const shortcutCheckboxes = document.querySelectorAll('.shortcut-checkbox');
        const unlearnButton = document.getElementById('unlearn-selected');
        const searchInput = document.getElementById('search-input');
        const shortcutItems = document.querySelectorAll('.shortcut-item');
        
        // Search functionality
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                
                shortcutItems.forEach(item => {
                    const checkbox = item.querySelector('.shortcut-checkbox');
                    const shortcut = checkbox.dataset.shortcut.toLowerCase();
                    const action = checkbox.dataset.action.toLowerCase();
                    
                    if (shortcut.includes(query) || action.includes(query)) {
                        item.classList.remove('hidden');
                    } else {
                        item.classList.add('hidden');
                        // Uncheck hidden items so they don't get selected by "Select All"
                        checkbox.checked = false;
                    }
                });
                
                // Update select all and button state after filtering
                updateSelectAllState();
                updateButtonState();
            });
        }
        
        // Update button state based on selection
        function updateButtonState() {
            const visibleCheckboxes = Array.from(shortcutCheckboxes).filter(cb => !cb.closest('.shortcut-item').classList.contains('hidden'));
            const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
            if (unlearnButton) {
                unlearnButton.disabled = checkedCount === 0;
            }
        }

        function updateSelectAllState() {
            if (selectAllCheckbox) {
                const visibleCheckboxes = Array.from(shortcutCheckboxes).filter(cb => !cb.closest('.shortcut-item').classList.contains('hidden'));
                
                if (visibleCheckboxes.length === 0) {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = false;
                    selectAllCheckbox.disabled = true;
                    return;
                }
                
                selectAllCheckbox.disabled = false;
                const allChecked = visibleCheckboxes.every(cb => cb.checked);
                const noneChecked = visibleCheckboxes.every(cb => !cb.checked);
                selectAllCheckbox.checked = allChecked;
                selectAllCheckbox.indeterminate = !allChecked && !noneChecked;
            }
        }
        
        // Select all functionality
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const visibleCheckboxes = Array.from(shortcutCheckboxes).filter(cb => !cb.closest('.shortcut-item').classList.contains('hidden'));
                visibleCheckboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                });
                updateButtonState();
            });
        }
        
        // Individual checkbox change
        shortcutCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                updateButtonState();
                updateSelectAllState();
            });
        });
        
        // Unlearn selected button
        if (unlearnButton) {
            unlearnButton.addEventListener('click', () => {
                const checkedBoxes = Array.from(shortcutCheckboxes).filter(cb => cb.checked);
                
                if (checkedBoxes.length === shortcutCheckboxes.length) {
                    // If all are selected, use unlearnAll
                    vscode.postMessage({
                        command: 'unlearnAll'
                    });
                } else {
                    // Unlearn individual shortcuts
                    checkedBoxes.forEach(cb => {
                        vscode.postMessage({
                            command: 'unlearn',
                            shortcut: cb.dataset.shortcut,
                            action: cb.dataset.action
                        });
                    });
                }
            });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Escapes HTML special characters to prevent XSS.
     */
    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}
