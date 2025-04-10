import { describe, expect, test } from 'vitest';
import { SelectValueCollector } from '../../src/visitors/SelectValueCollector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/visitors/Formatter';

const formatter = new Formatter();

// Definition of test suite
describe('SelectValueCollectorWildcard', () => {
    // Type definition for function that returns column names from table name
    type TableColumnResolver = (tableName: string) => string[];
    // Test resolver that returns column names from table name
    const mockTableResolver: TableColumnResolver = (tableName: string): string[] => {
        const tableColumns: Record<string, string[]> = {
            'users': ['id', 'name', 'email', 'created_at'],
            'posts': ['id', 'title', 'content', 'user_id', 'created_at'],
            'comments': ['id', 'post_id', 'user_id', 'content', 'created_at']
        };

        return tableColumns[tableName] || [];
    };

    test('Simple wildcard expansion for SELECT * FROM table', () => {
        // Arrange - simple * wildcard
        const sql = `SELECT * FROM users`;
        const query = SelectQueryParser.parseFromText(sql);
        const collector = new SelectValueCollector(mockTableResolver);

        // Act
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.visit(item.value));
        // Assert
        expect(items.length).toBe(4); // all columns from users table
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('email');
        expect(columnNames).toContain('created_at');

        // Verify expression content
        expect(expressions).toContain('"users"."id"');
        expect(expressions).toContain('"users"."name"');
        expect(expressions).toContain('"users"."email"');
        expect(expressions).toContain('"users"."created_at"');
    });

    test('Wildcard expansion from subquery', () => {
        // Arrange - * wildcard in subquery
        const sql = `SELECT * FROM (SELECT id, name FROM users)`;
        const query = SelectQueryParser.parseFromText(sql);
        const collector = new SelectValueCollector(mockTableResolver);

        // Act
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.visit(item.value));        // Assert - only columns explicitly selected in the subquery are expanded
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).not.toContain('email'); // non-selected column
        expect(items.length).toBe(2);

        // Verify expression content
        expect(expressions).toContain('"id"');
        expect(expressions).toContain('"name"');
    });

    test('Wildcard expansion with table alias', () => {
        // Arrange - u.* wildcard with table alias
        const sql = `SELECT u.* FROM users u`;
        const query = SelectQueryParser.parseFromText(sql);
        const collector = new SelectValueCollector(mockTableResolver);

        // Act
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.visit(item.value));        // Assert
        expect(items.length).toBe(4); // all columns from users table
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('email');
        expect(columnNames).toContain('created_at');

        // Verify expression content
        expect(expressions).toContain('"u"."id"');
        expect(expressions).toContain('"u"."name"');
        expect(expressions).toContain('"u"."email"');
        expect(expressions).toContain('"u"."created_at"');
    });

    test('Multiple table join with specific columns from one table and all columns from another', () => {
        // Arrange - JOIN query with combination of p.id, p.title, u.*
        const sql = `SELECT p.id, p.title, u.* FROM posts p INNER JOIN users u ON p.user_id = u.id`;
        const query = SelectQueryParser.parseFromText(sql);
        const collector = new SelectValueCollector(mockTableResolver);

        // Act
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.visit(item.value));        // Assert
        expect(items.length).toBe(5); // posts(2) + users(4) - duplicate id is excluded(1)

        // Specific columns from posts table
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('title');

        // All columns from users table, however duplicate id is excluded.
        // This differs from actual DB behavior, but due to the SQL processing library's characteristics, column name duplications are not allowed.
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('email');
        expect(columnNames).toContain('created_at');        // Verify expression content
        expect(expressions).toContain('"p"."id"');
        expect(expressions).toContain('"p"."title"');
        expect(expressions).toContain('"u"."name"');
        expect(expressions).toContain('"u"."email"');
        expect(expressions).toContain('"u"."created_at"');
    });

    test('Wildcard expansion with column aliases', () => {
        // Arrange - * wildcard with column aliases
        const sql = `SELECT * FROM (SELECT * FROM users) AS u(user_id, user_name, user_email, user_created_at)`;
        const query = SelectQueryParser.parseFromText(sql);
        const collector = new SelectValueCollector(mockTableResolver);

        // Act
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.visit(item.value));        // Assert
        expect(items.length).toBe(4); // all columns from users table (with aliases)
        expect(columnNames).toContain('user_id');
        expect(columnNames).toContain('user_name');
        expect(columnNames).toContain('user_email');
        expect(columnNames).toContain('user_created_at');

        // Verify expression content
        expect(expressions).toContain('"u"."user_id"');
        expect(expressions).toContain('"u"."user_name"');
        expect(expressions).toContain('"u"."user_email"');
        expect(expressions).toContain('"u"."user_created_at"');
    });

    test('Combination of computed columns and * wildcard', () => {
        // Arrange - combination of expression and *
        const sql = `SELECT u.id + 100 AS id_plus_100, u.* FROM users u`;
        const query = SelectQueryParser.parseFromText(sql);
        const collector = new SelectValueCollector(mockTableResolver);

        // Act
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.visit(item.value));        // Assert
        expect(items.length).toBe(5); // 1 expression + 4 columns from users table
        expect(columnNames).toContain('id_plus_100');
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('email');
        expect(columnNames).toContain('created_at');

        // Verify expression content
        expect(expressions).toContain('"u"."id" + 100');
        expect(expressions).toContain('"u"."id"');
        expect(expressions).toContain('"u"."name"');
        expect(expressions).toContain('"u"."email"');
        expect(expressions).toContain('"u"."created_at"');
    });
});
