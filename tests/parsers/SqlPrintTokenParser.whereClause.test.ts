import { describe, it, expect } from 'vitest';
import { SqlPrintTokenParser } from '../../src/parsers/SqlPrintTokenParser';
import { SqlPrinter } from '../../src/transformers/SqlPrinter';
import { WhereClauseParser } from '../../src/parsers/WhereClauseParser';

// This test class is for WhereClause printing only.
describe('SqlPrintTokenParser + SqlPrinter (WhereClause)', () => {
    it('should print simple WHERE clause with identifier = value', () => {
        // Arrange
        const node = WhereClauseParser.parse('where id = 1');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        // Expected: where "id" = 1
        expect(sql).toBe('where "id" = 1');
    });

    it('should print WHERE clause with AND', () => {
        // Arrange
        const node = WhereClauseParser.parse("where id = 1 and name = 'foo'");
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        // Expected: where "id" = 1 and "name" = 'foo'
        expect(sql).toBe('where "id" = 1 and "name" = \'foo\'');
    });
});
