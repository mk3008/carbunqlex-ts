import { describe, expect, test } from 'vitest';
import { SelectableColumnCollector } from '../../src/transformers/SelectableColumnCollector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';

const formatter = new Formatter();

describe('SelectableColumnCollector', () => {
    test('collects basic column references', () => {
        // Arrange
        const sql = `SELECT id, name FROM users WHERE active = TRUE`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        expect(items.length).toBe(3); // id, name, active

        // Check that columns are included
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('active');
    });

    test('collects column references with table qualifiers', () => {
        // Arrange
        const sql = `SELECT u.id, u.name FROM users u WHERE u.active = TRUE`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        expect(items.length).toBe(3); // u.id, u.name, u.active

        // Check that qualified columns are included
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('active');
    });

    test('collects column references from complex WHERE clauses', () => {
        // Arrange
        const sql = `
            SELECT id, name 
            FROM users 
            WHERE 
                (age > 18 AND status = 'active') 
                OR (role = 'admin' AND created_at > '2023-01-01')
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        expect(items.length).toBe(6); // id, name, age, status, role, created_at

        // Check that all columns are included
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('age');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('role');
        expect(columnNames).toContain('created_at');
    });

    test('collects column references from queries with JOINs', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name, p.phone, a.street
            FROM users u
            JOIN profiles p ON u.id = p.user_id
            LEFT JOIN addresses a ON u.id = a.user_id
            WHERE u.active = TRUE AND p.verified = TRUE
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        expect(items.length).toBe(7);

        // Check that main columns are included
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('active');
        expect(columnNames).toContain('phone');
        expect(columnNames).toContain('user_id');
        expect(columnNames).toContain('verified');
        expect(columnNames).toContain('street');
    });

    test('collects column references from queries with GROUP BY and ORDER BY', () => {
        // Arrange
        const sql = `
            SELECT 
                department_id, 
                COUNT(*) as count,
                AVG(salary) as avg_salary
            FROM employees
            WHERE hire_date > '2022-01-01'
            GROUP BY department_id
            HAVING AVG(salary) > 50000
            ORDER BY avg_salary DESC
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        expect(items.length).toBe(5);

        // Check that all columns are included
        expect(columnNames).toContain('department_id');
        expect(columnNames).toContain('salary');
        expect(columnNames).toContain('hire_date');
        expect(columnNames).toContain('count');
        expect(columnNames).toContain('avg_salary');
    });

    test('should not collect wildcard (*) as a column reference', () => {
        // Arrange
        const sql = `SELECT * FROM users`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        expect(items.length).toBe(0);
        // Wildcard * is not collected as a column reference
    });

    test('should collect available columns from subquery sources', () => {
        // Arrange - Query using subquery as a source
        const sql = `
            SELECT sub.id, sub.custom_name, sub.calculated_value
            FROM (
                SELECT u.id, u.name AS custom_name, u.age * 2 AS calculated_value
                FROM users u
            ) AS sub
            WHERE sub.calculated_value > 50
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert - Only columns exposed from the subquery are collected        expect(columnNames).toContain('id');
        expect(columnNames).toContain('custom_name');
        expect(columnNames).toContain('calculated_value');
        // Internal table columns cannot be referenced directly and are not included
        expect(columnNames).not.toContain('u.id');
        expect(columnNames).not.toContain('u.name');
        expect(columnNames).not.toContain('u.age');
    });

    test('should collect available columns from CTE sources', () => {
        // Arrange - Query using CTE (Common Table Expression)
        const sql = `
            WITH user_summary AS (
                SELECT u.id, u.name, COUNT(o.id) AS order_count
                FROM users u
                LEFT JOIN orders o ON u.id = o.user_id
                GROUP BY u.id, u.name
            )
            SELECT 
                us.id,
                us.name,
                us.order_count
            FROM user_summary us
            WHERE us.order_count > 0
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert - Only columns exposed from the CTE are collected        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('order_count');
        // Internal table columns from CTE cannot be referenced directly and are not included
        expect(columnNames).not.toContain('u.id');
        expect(columnNames).not.toContain('u.name');
        expect(columnNames).not.toContain('o.user_id');
    });

    test('collects column references from subqueries but not from CTEs', () => {
        // Arrange
        const sql = `
            WITH cte AS (
                SELECT id, name FROM temp_table WHERE status = 'pending'
            )
            SELECT 
                u.id,
                u.name,
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count
            FROM users u
            WHERE u.id IN (SELECT user_id FROM permissions WHERE role = 'admin')
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        // Only references from the data source defined in the root FROM clause (users u) are targeted
        expect(items.length).toBe(3);

        // Confirm that the main query columns are included (data source defined in the root FROM clause)        expect(columnNames).toContain('id');    // Column of the data source 'users u' in the root FROM clause, so targeted
        expect(columnNames).toContain('name');  // Column of the data source 'users u' in the root FROM clause, so targeted

        // Confirm that subquery columns are not included
        expect(columnNames).not.toContain('o.user_id'); // Column within the subquery, not a data source in the root FROM clause, so excluded
        expect(columnNames).not.toContain('user_id');   // Column of the permissions table, so excluded
        expect(columnNames).not.toContain('role');      // Column of the permissions table, so excluded

        // Confirm that CTE columns are not included
        expect(columnNames).not.toContain('status');       // Column in the WHERE clause of the CTE, so excluded
        expect(columnNames).not.toContain('temp_table.id'); // Column in the SELECT clause of the CTE, so excluded
        expect(columnNames).not.toContain('temp_table.name'); // Column in the SELECT clause of the CTE, so excluded
    });

    test('removes duplicate column references', () => {
        // Arrange
        const sql = `
    SELECT id, name 
    FROM users
    WHERE id = 1 AND id > 0
`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        // Note: Using the formatter for deduplication, references to the same table/column become a single instance
        expect(items.length).toBe(2); // id (after deduplication), name

        // Check that all columns are included
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');

        // Check that there is only one column reference with name 'id' (confirming deduplication)
        const idColumns = columnNames.filter(col => col === 'id');
        expect(idColumns.length).toBe(1);
    });

    test('starts a new collection after reset', () => {
        // Arrange
        const sql1 = `SELECT id, name FROM users`;
        const sql2 = `SELECT product_id, price FROM products`;

        const query1 = SelectQueryParser.parse(sql1);
        const query2 = SelectQueryParser.parse(sql2);
        const collector = new SelectableColumnCollector();

        // Act - First collection
        const firstColumns = collector.collect(query1).map(x => x.name);

        // Assert - First collection results
        expect(firstColumns.length).toBe(2);
        expect(firstColumns).toContain('id');
        expect(firstColumns).toContain('name');

        // Act - Reset and do second collection
        const secondColumns = collector.collect(query2).map(x => x.name);

        // Assert - Second collection results (should not contain items from first collection)
        expect(secondColumns.length).toBe(2);
        expect(secondColumns).toContain('product_id');
        expect(secondColumns).toContain('price');
        expect(secondColumns).not.toContain('id');
        expect(secondColumns).not.toContain('name');
    });

    test('collects virtual column references from subqueries in FROM clause', () => {
        // Arrange
        const sql = `
    SELECT sub.column_name, sub.another_col
    FROM (SELECT id AS column_name, name AS another_col FROM users) AS sub
    WHERE sub.column_name > 10
`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        expect(items.length).toBeGreaterThan(0);

        // Check that virtual columns from subquery are included        expect(columnNames).toContain('column_name');
        expect(columnNames).toContain('another_col');

        // Note: Current implementation doesn't access inner subquery columns directly
        // Original columns are not exposed outside the subquery context
    });

    test('collects virtual column references from subqueries in JOIN clause', () => {
        // Arrange
        const sql = `
    SELECT u.id, u.name, s.product_count
    FROM users u
    JOIN (SELECT user_id, COUNT(*) AS product_count 
          FROM purchases 
          GROUP BY user_id) AS s ON u.id = s.user_id
    WHERE s.product_count > 5
`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert        expect(items.length).toBeGreaterThan(0);

        // Check main table columns
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');

        // Check virtual columns from JOIN subquery
        expect(columnNames).toContain('product_count');
        expect(columnNames).toContain('user_id'); // Joined column

        // Note: Current implementation may not handle all subquery columns consistently
    });

    test('collects complex columns from nested subqueries', () => {
        // Arrange - Test for multiple levels of nested subqueries
        const sql = `
    SELECT outer_query.user_name, outer_query.total
    FROM (
        SELECT d.name AS dept_name, 
               (SELECT AVG(salary) FROM employees e WHERE e.dept_id = d.id) AS avg_salary
        FROM departments d
    ) AS outer_sub
    WHERE outer_sub.avg_salary > 50000
`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        expect(items.length).toBe(4);        // Check virtual columns from outer subquery
        expect(columnNames).toContain('user_name');
        expect(columnNames).toContain('total');
        expect(columnNames).toContain('dept_name');
        expect(columnNames).toContain('avg_salary');

        // Note: Internal subquery columns aren't directly accessible in current implementation
        // The internal column references are only used within their subquery context
    });

    test('collects columns from subquery definitions correctly', () => {
        // Arrange - Verify that columns can be properly collected from subqueries
        const sql = `
            SELECT b.id 
            FROM (SELECT a.id, a.value FROM table_a as a) AS b
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));        // Debug output
        console.log('Debug - actual columns returned:', columnNames);

        // Assert        // Both columns defined in the subquery's SELECT clause should be available
        // Length check is temporarily disabled
        expect(items.length).toBe(2);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('value');
    });

    test('collects complex columns from nested subqueries', () => {
        // Arrange - Test for multiple levels of nested subqueries
        const sql = `
            SELECT outer_query.user_name, outer_query.total
            FROM (
                SELECT 
                    user_data.name as user_name, 
                    user_data.email as user_email,
                    (
                        SELECT SUM(o.amount)
                        FROM orders o
                        WHERE o.user_id = user_data.id
                    ) as total
                FROM (
                    SELECT u.id, u.name, u.email, u.status
                    FROM users u
                    WHERE u.active = TRUE
                ) as user_data
                WHERE user_data.status = 'premium'
            ) as outer_query
            WHERE outer_query.total > 1000
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert        // Columns defined in the outer subquery are available
        expect(columnNames).toContain('user_name');
        expect(columnNames).toContain('total');
        expect(columnNames).toContain('user_email');

        // Inner subquery columns cannot be directly referenced and are not included
        expect(columnNames).not.toContain('user_data.name');
        expect(columnNames).not.toContain('user_data.id');
    });

    test('collects columns from both CTE and subqueries correctly', () => {
        // Arrange - Test for combination of CTE and subqueries
        const sql = `
            WITH customer_data AS (
                SELECT 
                    c.id,
                    c.name as customer_name,
                    c.region,
                    c.segment
                FROM customers c
            )
            SELECT 
                report.customer_name,
                report.region,
                report.total_purchases
            FROM (
                SELECT 
                    cd.customer_name,
                    cd.region,
                    SUM(o.amount) as total_purchases,
                    COUNT(o.id) as order_count
                FROM customer_data cd
                JOIN orders o ON cd.id = o.customer_id
                GROUP BY cd.customer_name, cd.region
            ) AS report
            WHERE report.total_purchases > 5000
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert        // Columns from the subquery are collected
        expect(columnNames).toContain('customer_name');
        expect(columnNames).toContain('region');
        expect(columnNames).toContain('total_purchases');
        expect(columnNames).toContain('order_count');

        // Internal columns from CTE and subqueries are not included
        expect(columnNames).not.toContain('cd.customer_name');
        expect(columnNames).not.toContain('cd.id');
        expect(columnNames).not.toContain('o.amount');
    });

    test('collects columns from deeply nested subqueries with wildcards', () => {
        // Arrange - Test case for deeply nested subqueries with multiple layers
        const sql = `
            SELECT * FROM (
                SELECT * FROM (
                    SELECT a.id FROM table_a as a
                ) AS b
            ) AS c
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));        // Debug output
        console.log('Deeply nested subquery columns:', columnNames);

        // Assert        expect(items.length).toBe(1);

        // Only the column from the outermost subquery is accessible
        expect(columnNames).toContain('id');

        // Inner subquery columns are not accessible from outside
        expect(columnNames).not.toContain('a.id');
        expect(columnNames).not.toContain('b.id');
    });

    test('handles nested subquery with wildcard but no underlying column information', () => {
        // Arrange - Test case for nested subqueries where the innermost source doesn't provide column information
        const sql = `
            SELECT * FROM (SELECT * FROM a) AS b
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));        // Debug output
        console.log('Nested subquery with unknown source columns:', columnNames);

        // Assert
        // Since 'a' is just a table name with no column info available statically
        // we can't determine what columns are available through the subquery
        expect(items.length).toBe(0);
    });

    test('handles multi-level nested subqueries with unknown columns', () => {
        // Arrange - Multiple levels where column info is lost
        const sql = `
            SELECT * FROM (
                SELECT * FROM (
                    SELECT * FROM unknown_table
                ) AS inner_query
            ) AS outer_query
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));        // Debug output
        console.log('Multi-level nested with unknown columns:', columnNames);

        // Assert
        // No column information is available since the base table's structure is unknown
        expect(items.length).toBe(0);
    });

    test('tableColumnResolver is optional and backward compatible', () => {
        // Arrange - Use original behavior without resolver
        const sql = `SELECT * FROM users WHERE active = TRUE`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector(); // No resolver passed in

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        // Should behave like before - not resolving wildcard columns from physical tables
        expect(items.length).toBe(1); // Only 'active' from WHERE clause, wildcard not expanded
        expect(columnNames).toContain('active');
    });

    test('collects column references from window function with PARTITION BY', () => {
        // Arrange
        const sql = `SELECT sum(tax) OVER(PARTITION BY user_id) FROM sales`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);
        const expressions = items.map(item => formatter.format(item.value));

        // Assert
        expect(columnNames).toContain('user_id');
        expect(columnNames).toContain('tax');
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
        const collector = new SelectableColumnCollector();

        // Act
        collector.visit(query);
        const items = collector.collect(query);
        const columnNames = items.map(item => item.name);

        // Assert
        expect(columnNames).toContain('line_id');
    });
});
