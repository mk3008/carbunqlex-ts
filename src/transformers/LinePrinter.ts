// Define the allowed newline options
export type NewlineOption = ' ' | '\n' | '\r\n';

// Define the allowed indent character options
export type IndentCharOption = '' | ' ' | '\t';

/**
 * SqlPrintHelper provides utility methods for SQL pretty printing.
 */
export class LinePrinter {
    indentChar: IndentCharOption; // Changed type to IndentCharOption
    indentSize: number;
    newline: NewlineOption; // Changed type to NewlineOption
    lines: PrintLine[];
    /**
     * @param indentChar Character used for indentation (default: ' ') // Updated comment to reflect options
     * @param indentSize Number of indentChar per level (default: 0)
     * @param newline Newline string (default: '\r\n') // Changed type and default value
     */
    constructor(indentChar: IndentCharOption = ' ', indentSize: number = 0, newline: NewlineOption = '\r\n') { // Changed type for indentChar
        this.indentChar = indentChar;
        this.indentSize = indentSize;
        this.newline = newline;
        this.lines = [];
        this.appendNewline(0);
    }

    public print(): string {
        let result = '';
        for (const line of this.lines) {
            if (line.text !== '') {
                // append indent and text
                result += this.indent(line.level) + line.text;
            }
        }
        return result.trimEnd();
    }

    /**
     * Returns the indent string for a given level.
     * @param level Indentation level
     */
    private indent(level: number): string {
        return this.indentChar.repeat(this.indentSize * level);
    }

    /**
     * Appends a newline token to the given tokens array if newline is set, or adds an empty line if tokens is empty.
     * @param tokens Array of token objects with 'level' and 'text' property
     * @param level Indentation level
     */
    appendNewline(level: number): void {
        if (this.lines.length > 0) {
            const current = this.lines[this.lines.length - 1];
            if (current.text !== '') {
                current.text = current.text.trimEnd() + this.newline;
            }
        }
        this.lines.push(new PrintLine(level, ''));
    }

    /**
     * Appends text to the last element of tokens array.
     * @param tokens Array of token objects with 'text' property
     * @param text Text to append
     */
    appendText(text: string): void {
        if (this.lines.length > 0) {
            const workingIndex = this.lines.length - 1;
            const workLine = this.lines[workingIndex]
            // Leading space is not needed
            if (!(text === ' ' && workLine.text === '')) {
                workLine.text += text;
            }
        } else {
            throw new Error('No tokens to append to.');
        }
    }

    getCurrentLine(): PrintLine {
        if (this.lines.length > 0) {
            return this.lines[this.lines.length - 1];
        } else {
            throw new Error('No tokens to get current line from.');
        }
    }
}

export class PrintLine {
    level: number;
    text: string;

    constructor(level: number, text: string) {
        this.level = level;
        this.text = text;
    }
}