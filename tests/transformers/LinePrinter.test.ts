// Test cases for LinePrinter class
// This file tests one-liner, leading comma, and trailing comma SQL formatting patterns.
import { describe, it, expect } from 'vitest';
import { LinePrinter } from '../../src/transformers/LinePrinter';

// Helper to simulate SQL column list
const columns = ['id', 'name', 'age'];

// --- One-liner pattern ---
describe('LinePrinter - One-liner', () => {
    it('should print columns in one line', () => {
        const printer = new LinePrinter('', 0, ' ');
        printer.appendText('SELECT ');
        printer.appendText(columns.join(', '));
        printer.appendText(' FROM users');
        const result = printer.print();
        expect(result).toBe('SELECT id, name, age FROM users');
    });
});

// --- Leading comma pattern ---
describe('LinePrinter - Leading comma', () => {
    it('should print columns with leading commas and indentation', () => {
        const printer = new LinePrinter(' ', 2, '\n');
        printer.appendText('SELECT');
        columns.forEach((col, i) => {
            printer.appendNewline(1);
            if (i === 0) {
                printer.appendText(col);
            } else {
                printer.appendText(', ');
                printer.appendText(col);
            }
        });
        printer.appendNewline(0);
        printer.appendText('FROM users');
        const result = printer.print();
        expect(result).toBe(
            'SELECT\n  id\n  , name\n  , age\nFROM users'
        );
    });
});

// --- Trailing comma pattern ---
describe('LinePrinter - Trailing comma aligned', () => {
    it('should print columns with trailing commas and indentation', () => {
        const printer = new LinePrinter(' ', 2, '\n');
        printer.appendText('SELECT');
        columns.forEach((col, i) => {
            printer.appendNewline(1);
            if (i < columns.length - 1) {
                printer.appendText(col + ',');
            } else {
                printer.appendText(col);
            }
        });
        printer.appendNewline(0);
        printer.appendText('FROM users');
        const result = printer.print();
        expect(result).toBe(
            'SELECT\n  id,\n  name,\n  age\nFROM users'
        );
    });
});
