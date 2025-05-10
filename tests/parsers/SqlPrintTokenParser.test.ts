
import { describe, it, expect } from 'vitest';
import { SqlPrintTokenParser } from '../../src/parsers/SqlPrintTokenParser';
import { SqlPrinter } from '../../src/transformers/SqlPrinter';
import { ValueParser } from '../../src/parsers/ValueParser';
import { SelectClauseParser, SelectItemParser } from '../../src/parsers/SelectClauseParser';

describe('SqlPrintTokenParser + SqlPrinter', () => {
    it('should print simple identifier', () => {
        // Arrange
        const node = ValueParser.parse('hoge');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"hoge"');
    });

    it('should print literal value', () => {
        // Arrange
        const node = ValueParser.parse('123');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('123');
    });

    it('should print function call', () => {
        // Arrange
        const node = ValueParser.parse('COUNT(1)');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('count(1)');
    });

    it('should print function call with multiple arguments', () => {
        // Arrange
        const node = ValueParser.parse('CONCAT(a, b, c)');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('concat("a", "b", "c")');
    });

    it('should print function call with no arguments', () => {
        // Arrange
        const node = ValueParser.parse('NOW()');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('now()');
    });

    it('should print binary operation', () => {
        // Arrange
        const node = ValueParser.parse('1 + 2 * 3');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('1 + 2 * 3');
    });

    it('should print function call with over clause', () => {
        // Arrange
        const node = ValueParser.parse('row_number() over(partition by department_id order by salary desc)');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('row_number() over(partition by "department_id" order by "salary" desc)');
    });

    it('should print parenthesis', () => {
        // Arrange
        const node = ValueParser.parse("('abc')");
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        // 例: (abc)
        expect(sql).toBe("('abc')");
    });

    it('should print type value with namespace', () => {
        // Arrange
        const node = ValueParser.parse("1::pg_catalog.int4");
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('1::"pg_catalog".int4');
    });

    it('should print string specifier', () => {
        // Arrange
        const node = ValueParser.parse("E'abc'");
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe(`E'abc'`);
    });

    // Test for unary operator (e.g. -1)
    it('should print unary minus', () => {
        // Arrange
        const node = ValueParser.parse('not true');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('not true');
    });

    // Test for CASE WHEN ... THEN ... ELSE ... END
    it('should print simple CASE WHEN expression', () => {
        // Arrange
        const node = ValueParser.parse('case when a = 1 then 2 else 3 end');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('case when "a" = 1 then 2 else 3 end');
    });

    // Test for CASE <expr> WHEN ... THEN ... ELSE ... END
    it('should print CASE <expr> WHEN expression', () => {
        // Arrange
        const node = ValueParser.parse('case a when 1 then 2 else 3 end');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('case "a" when 1 then 2 else 3 end');
    });

    // Test for BETWEEN expression
    it('should print BETWEEN expression', () => {
        // Arrange
        const node = ValueParser.parse('a between 1 and 10');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"a" between 1 and 10');
    });

    it('should print select expression without alias', () => {
        // Arrange
        const node = SelectItemParser.parse('user.id');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"user"."id"');
    });

    it('should print select expression with alias', () => {
        // Arrange
        const node = SelectItemParser.parse('user.id as user_id');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"user"."id" as "user_id"');
    });

    it('should print select expression with alias omitted', () => {
        // Arrange
        const node = SelectItemParser.parse('user.id as id');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"user"."id"');
    });

    it('should print select clause without distinct, single column', () => {
        // Arrange
        const node = SelectClauseParser.parse('select id');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('select "id"');
    });

    it('should print select clause without distinct, multiple columns', () => {
        // Arrange
        const node = SelectClauseParser.parse('select id, name, age');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('select "id", "name", "age"');
    });

    it('should print select clause with distinct', () => {
        // Arrange
        const node = SelectClauseParser.parse('select distinct id');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('select distinct "id"');
    });

    it('should print select clause with distinct on', () => {
        // Arrange
        const node = SelectClauseParser.parse('select distinct on(id) name');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('select distinct on("id") "name"');
    });
});
