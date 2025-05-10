import { describe, expect, test } from 'vitest';
import { CTECollector } from '../../src/transformers/CTECollector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('CTECollector', () => {
    test('collects simple WITH clause common tables', () => {
        // Arrange
        const sql = `
            WITH temp_sales AS (
                SELECT * FROM sales WHERE date >= '2024-01-01'
            )
            SELECT * FROM temp_sales
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(1);
        expect(commonTables[0].aliasExpression.table.name).toBe('temp_sales');
    });

    test('collects multiple WITH clause common tables', () => {
        // Arrange
        const sql = `
            WITH 
                sales_2024 AS (
                    SELECT * FROM sales WHERE year = 2024
                ),
                top_products AS (
                    SELECT product_id, SUM(quantity) as total 
                    FROM sales_2024 
                    GROUP BY product_id 
                    ORDER BY total DESC 
                    LIMIT 10
                )
            SELECT p.name, tp.total
            FROM products p
            JOIN top_products tp ON p.id = tp.product_id
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(2);
        // The improved implementation preserves the original order for CTEs at the same depth
        expect(commonTables[0].aliasExpression.table.name).toBe('sales_2024');
        expect(commonTables[1].aliasExpression.table.name).toBe('top_products');
    });

    test('collects recursive WITH clause common tables', () => {
        // Arrange
        const sql = `
            WITH RECURSIVE employees_path(id, name, path) AS (
                SELECT id, name, CAST(id AS TEXT) as path 
                FROM employees 
                WHERE manager_id IS NULL
                UNION ALL
                SELECT e.id, e.name, ep.path || '->' || CAST(e.id AS TEXT)
                FROM employees e 
                JOIN employees_path ep ON e.manager_id = ep.id
            )
            SELECT * FROM employees_path
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(1);
        expect(commonTables[0].aliasExpression.table.name).toBe('employees_path');
    });

    test('collects nested WITH clauses in subqueries', () => {
        // Arrange
        const sql = `
            SELECT * 
            FROM (
                WITH nested_cte AS (
                    SELECT id, value FROM data WHERE type = 'important'
                )
                SELECT * FROM nested_cte
            ) AS subquery
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(1);
        expect(commonTables[0].aliasExpression.table.name).toBe('nested_cte');
    });

    test('collects WITH clauses in both parts of UNION queries', () => {
        // Arrange
        const sql = `
            WITH cte1 AS (SELECT id FROM table1)
            SELECT * FROM cte1
            UNION
            WITH cte2 AS (SELECT id FROM table2)
            SELECT * FROM cte2
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(2);
        expect(commonTables[0].aliasExpression.table.name).toBe('cte1');
        expect(commonTables[1].aliasExpression.table.name).toBe('cte2');
    });

    test('collects WITH clauses in complex query with multiple nesting levels', () => {
        // Arrange
        const sql = `
            WITH outer_cte AS (
                SELECT * FROM (
                    WITH inner_cte AS (
                        SELECT id, name FROM users
                    )
                    SELECT ic.*
                    FROM inner_cte ic
                    JOIN (
                        WITH deepest_cte AS (
                            SELECT * FROM profiles
                        )
                        SELECT * FROM deepest_cte
                    ) AS deep ON ic.id = deep.user_id
                ) AS mid
            )
            SELECT * FROM outer_cte
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(3);
        expect(new Set(commonTables.map(ct => ct.aliasExpression.table.name))).toEqual(new Set(['outer_cte', 'inner_cte', 'deepest_cte']));
    });

    test('collects WITH clauses in WHERE clause subqueries', () => {
        // Arrange
        const sql = `
            SELECT *
            FROM users
            WHERE department_id IN (
                WITH top_departments AS (
                    SELECT id FROM departments WHERE budget > 1000000
                )
                SELECT id FROM top_departments
            )
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(1);
        expect(commonTables[0].aliasExpression.table.name).toBe('top_departments');
    });

    test('collects deeply nested WITH clauses (with_a -> with_b -> with_c)', () => {
        // Arrange
        const sql = `
            WITH with_a AS (
                SELECT * FROM (
                    WITH with_b AS (
                        SELECT * FROM (
                            WITH with_c AS (
                                SELECT id, value FROM deep_data WHERE status = 'active'
                            )
                            SELECT c.id, c.value, 'level_c' as level
                            FROM with_c c
                        )
                    )
                    SELECT b.id, b.value, b.level, 'level_b' as parent_level
                    FROM with_b b
                )
            )
            SELECT a.id, a.value, a.level, a.parent_level, 'level_a' as root_level
            FROM with_a a
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(3);

        // All three CTEs should be collected
        const tableNames = commonTables.map(ct => ct.aliasExpression.table.name);
        expect(tableNames).toContain('with_a');
        expect(tableNames).toContain('with_b');
        expect(tableNames).toContain('with_c');

        // Optional: Check the order (though order is not guaranteed by the collector)
        // expect(tableNames[0]).toBe('with_a');
        // expect(tableNames[1]).toBe('with_b');
        // expect(tableNames[2]).toBe('with_c');
    });

    test('collects deeply nested WITH clauses in correct order (inner to outer)', () => {
        // Arrange
        const sql = `
            WITH with_a AS (
                SELECT * FROM (
                    WITH with_b AS (
                        SELECT * FROM (
                            WITH with_c AS (
                                SELECT id, value FROM deep_data WHERE status = 'active'
                            )
                            SELECT c.id, c.value, 'level_c' as level
                            FROM with_c c
                        )
                    )
                    SELECT b.id, b.value, b.level, 'level_b' as parent_level
                    FROM with_b b
                )
            )
            SELECT a.id, a.value, a.level, a.parent_level, 'level_a' as root_level
            FROM with_a a
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(3);

        // Check exact order to ensure inner CTEs are collected before outer CTEs
        // The expected order should be with_c (innermost), with_b (middle), with_a (outermost)
        const tableNames = commonTables.map(ct => ct.aliasExpression.table.name);

        // Log actual order for debugging
        console.log('CTE collection order:', tableNames);

        // Verify inner CTEs are collected before outer CTEs
        const indexC = tableNames.indexOf('with_c');
        const indexB = tableNames.indexOf('with_b');
        const indexA = tableNames.indexOf('with_a');

        expect(indexC).toBeLessThan(indexB);
        expect(indexB).toBeLessThan(indexA);
    });

    test('resets collection between visits', () => {
        // Arrange
        const sql1 = `WITH cte1 AS (SELECT 1) SELECT * FROM cte1`;
        const sql2 = `WITH cte2 AS (SELECT 2), cte3 AS (SELECT 3) SELECT * FROM cte2, cte3`;

        const query1 = SelectQueryParser.parse(sql1);
        const query2 = SelectQueryParser.parse(sql2);
        const collector = new CTECollector();

        // Act - First collection
        collector.visit(query1);
        const tables1 = collector.getCommonTables();

        // Assert - First collection
        expect(tables1.length).toBe(1);
        expect(tables1[0].aliasExpression.table.name).toBe('cte1');

        // Act - Reset and second collection
        collector.visit(query2);
        const tables2 = collector.getCommonTables();

        // Assert - Second collection
        expect(tables2.length).toBe(2);
        // The improved implementation preserves the original order for CTEs at the same depth
        expect(tables2[0].aliasExpression.table.name).toBe('cte2');
        expect(tables2[1].aliasExpression.table.name).toBe('cte3');
    });

    test('handles a super complex query with multiple CTEs and FROM after WITH (issue #47)', () => {
        // Arrange
        const sql = `
with
dat(line_id, name, unit_price, quantity, tax_rate) as (
    values
    (1, 'apple' , 105, 5, 0.07),
    (2, 'orange', 203, 3, 0.07),
    (3, 'banana', 233, 9, 0.07),
    (4, 'tea'   , 309, 7, 0.08),
    (5, 'coffee', 555, 9, 0.08),
    (6, 'matcha'  , 456, 2, 0.08)
),
detail as (
    select
        q.*,
        trunc(q.price * (1 + q.tax_rate)) - q.price as tax,
        q.price * (1 + q.tax_rate) - q.price as raw_tax
    from
        (
            select
                dat.*,
                (dat.unit_price * dat.quantity) as price
            from
                dat
        ) q
),
tax_summary as (
    select
        d.tax_rate,
        trunc(sum(raw_tax)) as total_tax
    from
        detail d
    group by
        d.tax_rate
)
select
    line_id,
    name,
    unit_price,
    quantity,
    tax_rate,
    price,
    price + tax as tax_included_price,
    tax
from
    (
        select
            line_id,
            name,
            unit_price,
            quantity,
            tax_rate,
            price,
            tax + adjust_tax as tax
        from
            (
                select
                    q.*,
                    case when q.total_tax - q.cumulative >= q.priority then 1 else 0 end as adjust_tax
                from
                    (
                        select
                            d.*,
                            s.total_tax,
                            sum(d.tax) over (partition by d.tax_rate) as cumulative,
                            row_number() over (partition by d.tax_rate order by d.raw_tax % 1 desc, d.line_id) as priority
                        from
                            detail d
                            inner join tax_summary s on d.tax_rate = s.tax_rate
                    ) q
            ) q
    ) q
order by
    line_id
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new CTECollector();

        // Act
        collector.visit(query);
        const commonTables = collector.getCommonTables();

        // Assert
        expect(commonTables.length).toBe(3);
        expect(commonTables[0].getSourceAliasName()).toBe('dat');
        expect(commonTables[1].getSourceAliasName()).toBe('detail');
        expect(commonTables[2].getSourceAliasName()).toBe('tax_summary');
    });
});