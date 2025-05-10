import { describe, it, expect } from 'vitest';
import { SqlPrintTokenParser } from '../../src/parsers/SqlPrintTokenParser';
import { SqlPrinter } from '../../src/transformers/SqlPrinter';
import { SourceExpressionParser } from '../../src/parsers/SourceExpressionParser';
import { FromClauseParser } from '../../src/parsers/FromClauseParser';

describe('SqlPrintTokenParser + SqlPrinter (SourceExpressionParser)', () => {
    it('should print function table source with column alias', () => {
        // Arrange
        const sql = 'FROM get_product_names(m.id) AS pname(id, name)';
        const node = FromClauseParser.parse(sql);
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const result = printer.print(token);

        // Assert
        const expected = 'from get_product_names("m"."id") as "pname"("id", "name")';
        expect(result).toBe(expected);
    });

    it('should print joined table sources with USING', () => {
        // Arrange
        const sql = 'from foo f join bar b using (id)';
        const node = FromClauseParser.parse(sql);
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const result = printer.print(token);

        // Assert
        const expected = 'from "foo" as "f" join "bar" as "b" using("id")';
        expect(result).toBe(expected);
    });

    it('should print lateral join', () => {
        // Arrange
        const sql = 'FROM manufacturers m LEFT JOIN LATERAL get_product_names(m.id) pname ON true';
        const node = FromClauseParser.parse(sql);
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const result = printer.print(token);

        // Assert
        const expected = 'from "manufacturers" as "m" left join lateral get_product_names("m"."id") as "pname" on true';
        expect(result).toBe(expected);
    });

    it('should print cross join (comma style)', () => {
        // Arrange
        const sql = 'from foo, bar';
        const node = FromClauseParser.parse(sql);
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const result = printer.print(token);

        // Assert
        const expected = 'from "foo" cross join "bar"';
        expect(result).toBe(expected);
    });
    it('should print joined table sources', () => {
        // Arrange
        const sql = 'from alpha a inner join beta b on a.id = b.alpha_id';
        const node = FromClauseParser.parse(sql);
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const result = printer.print(token);

        // Assert
        const expected = 'from "alpha" as "a" inner join "beta" as "b" on "a"."id" = "b"."alpha_id"';
        expect(result).toBe(expected);
    });

    it('should print simple table name', () => {
        // Arrange
        const node = SourceExpressionParser.parse('users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"users"');
    });

    it('should print table name with schema', () => {
        // Arrange
        const node = SourceExpressionParser.parse('public.users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"public"."users"');
    });

    it('should print table name with alias', () => {
        // Arrange
        const node = SourceExpressionParser.parse('users u');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"users" as "u"');
    });

    it('should print table name with schema and alias', () => {
        // Arrange
        const node = SourceExpressionParser.parse('public.users as u');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"public"."users" as "u"');
    });

    it('should omit alias if same as table name', () => {
        // Arrange
        const node = SourceExpressionParser.parse('users as users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"users"');
    });
});
