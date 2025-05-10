import { describe, it, expect } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';
import { PRESETS } from '../../src/parsers/SqlPrintTokenParser';

describe('Formatter.formatWithParams', () => {
    it('should output SQL and params (named, default)', () => {
        // Arrange
        const sql = 'select * from users where id = :id and status = :status';
        const query = SelectQueryParser.parse(sql);
        query.setParameter('id', 123);
        query.setParameter('status', 'active');

        // Act
        const result = new Formatter().formatWithParameters(query);

        // Assert
        expect(result.sql).toBe('select * from "users" where "id" = :id and "status" = :status');
        expect(result.params).toEqual({ id: 123, status: 'active' });
    });

    it('should output SQL and params (postgres preset)', () => {
        // Arrange
        const sql = 'select * from users where id = :id and status = :status';
        const query = SelectQueryParser.parse(sql);
        query.setParameter('id', 123);
        query.setParameter('status', 'active');

        // Act
        const result = new Formatter().formatWithParameters(query, PRESETS.postgres);

        // Assert
        expect(result.sql).toBe('select * from "users" where "id" = $1 and "status" = $2');
        expect(result.params).toEqual([
            123,
            "active",
        ]);
    });

    it('should output SQL and params (anonymous, mysql preset)', () => {
        // Arrange
        const sql = 'select * from users where id = :id and status = :status';
        const query = SelectQueryParser.parse(sql);
        query.setParameter('id', 123);
        query.setParameter('status', 'active');

        // Act
        const result = new Formatter().formatWithParameters(query, PRESETS.mysql);

        // Assert
        expect(result.sql).toBe('select * from `users` where `id` = ? and `status` = ?');
        expect(result.params).toEqual([123, 'active']);
    });

    it('should output SQL and params (named, sqlserver preset)', () => {
        // Arrange
        const sql = 'select * from users where id = :id and status = :status';
        const query = SelectQueryParser.parse(sql);
        query.setParameter('id', 123);
        query.setParameter('status', 'active');

        // Act
        const result = new Formatter().formatWithParameters(query, PRESETS.sqlserver);

        // Assert
        expect(result.sql).toBe('select * from [users] where [id] = @id and [status] = @status');
        expect(result.params).toEqual({ id: 123, status: 'active' });
    });

    it('should output SQL and params (named, sqlite preset)', () => {
        // Arrange
        const sql = 'select * from users where id = :id and status = :status';
        const query = SelectQueryParser.parse(sql);
        query.setParameter('id', 123);
        query.setParameter('status', 'active');

        // Act
        const result = new Formatter().formatWithParameters(query, PRESETS.sqlite);

        // Assert
        expect(result.sql).toBe('select * from "users" where "id" = :id and "status" = :status');
        expect(result.params).toEqual({ id: 123, status: 'active' });
    });

    it('should output correct parameter order with CTEs and subqueries (indexed, postgres preset)', () => {
        // Arrange
        const sql = `
            WITH a AS (
                SELECT * FROM users WHERE status = :status
            )
            SELECT * FROM a WHERE id = :id OR name = :name
        `;
        // The registration order of setParameter does not affect the output order
        const query = SelectQueryParser.parse(sql);
        query.setParameter('name', 'Miku');
        query.setParameter('id', 42);
        query.setParameter('status', 'active');

        // Act
        const result = new Formatter().formatWithParameters(query, PRESETS.postgres);

        // Assert
        // Ensure that the parameter order in the output ($1, $2, $3) matches their appearance order (WITH clause → main query)
        expect(result.sql.replace(/\s+/g, ' ')).toContain('with "a" as (select * from "users" where "status" = $1) select * from "a" where "id" = $2 or "name" = $3');
        expect(result.params).toEqual([
            "active",
            42,
            "Miku",
        ]);
    });

    it('should reassign parameter indexes correctly after UNION ALL composition', () => {
        // Arrange
        const sql1 = 'select * from users where id = :id1';
        const sql2 = 'select * from users where id = :id2';
        const query1 = SelectQueryParser.parse(sql1);
        const query2 = SelectQueryParser.parse(sql2);
        query1.setParameter('id1', 100);
        query2.setParameter('id2', 200);

        // Output each query individually
        const result1 = new Formatter().formatWithParameters(query1, PRESETS.postgres);
        const result2 = new Formatter().formatWithParameters(query2, PRESETS.postgres);
        expect(result1.sql).toBe('select * from "users" where "id" = $1');
        expect(result1.params).toEqual([
            100,
        ]);
        expect(result2.sql).toBe('select * from "users" where "id" = $1');
        expect(result2.params).toEqual([
            200,
        ]);

        // Act
        // Output after composing (UNION ALL)  
        const unionQuery = QueryBuilder.buildBinaryQuery([query1, query2], 'union all');
        const unionResult = new Formatter().formatWithParameters(unionQuery, PRESETS.postgres);

        // Assert
        // Ensure that indexes are reassigned as 1, 2 after composition
        expect(unionResult.sql.replace(/\s+/g, ' ')).toContain('select * from "users" where "id" = $1 union all select * from "users" where "id" = $2');
        expect(unionResult.params).toEqual([100, 200]);
    });

    it('should merge named parameters with the same name and value, and throw if values differ (named, union)', () => {
        // Arrange
        const sql1 = 'select * from users where id = :id';
        const sql2 = 'select * from users where id = :id';
        const query1 = SelectQueryParser.parse(sql1);
        const query2 = SelectQueryParser.parse(sql2);
        query1.setParameter('id', 100);
        query2.setParameter('id', 100);

        // Act: merge with same name and value
        const unionQuery = QueryBuilder.buildBinaryQuery([query1, query2], 'union all');
        const unionResult = new Formatter().formatWithParameters(unionQuery, PRESETS.sqlserver);
        // Assert: only one param in the result
        expect(unionResult.sql.replace(/\s+/g, ' ')).toContain('select * from [users] where [id] = @id union all select * from [users] where [id] = @id');
        expect(unionResult.params).toEqual({ id: 100 });

        // Act & Assert: merge with same name but different value should throw
        query2.setParameter('id', 200);
        const unionQuery2 = QueryBuilder.buildBinaryQuery([query1, query2], 'union all');
        expect(() => new Formatter().formatWithParameters(unionQuery2, PRESETS.sqlserver)).toThrowError(/Duplicate parameter name 'id' with different values/);
    });
});
