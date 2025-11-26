import * as fs from 'fs';
import * as path from 'path';

export interface Shortcut {
    shortcut: string;
    action: string;
    interactionType: string;
    implemented: boolean;
}

export class ShortcutsLoader {
    private shortcuts: Shortcut[] = [];
    private shortcutsByType: Map<string, Shortcut[]> = new Map();

    constructor(private csvPath: string) { }

    public load(): void {
        const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
        const lines = csvContent.split('\n');

        // Skip header line
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                continue;
            }

            const parsed = this.parseCSVLine(line);
            if (parsed) {
                this.shortcuts.push(parsed);

                // Group by interaction type
                if (!this.shortcutsByType.has(parsed.interactionType)) {
                    this.shortcutsByType.set(parsed.interactionType, []);
                }
                this.shortcutsByType.get(parsed.interactionType)!.push(parsed);
            }
        }
    }

    private parseCSVLine(line: string): Shortcut | null {
        // Simple CSV parser that handles quoted fields
        const fields: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                fields.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        fields.push(currentField.trim());

        if (fields.length < 4) {
            return null;
        }

        return {
            interactionType: fields[0],
            implemented: fields[1].toLowerCase() === 'true',
            shortcut: fields[2],
            action: fields[3]
        };
    }

    public getShortcutsByType(interactionType: string): Shortcut[] {
        return this.shortcutsByType.get(interactionType) || [];
    }

    public getAllShortcuts(): Shortcut[] {
        return this.shortcuts;
    }
}
