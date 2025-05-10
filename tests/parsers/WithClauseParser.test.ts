import { describe, test, expect } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { WithClauseParser } from '../../src/parsers/WithClauseParser';

const formatter = new Formatter();

test('simple with clause', () => {
    // Arrange
    const text = `WITH temp_sales AS (SELECT * FROM sales WHERE date >= '2024-01-01')`;

    // Act
    const withClause = WithClauseParser.parse(text);
    const sql = formatter.format(withClause);

    // Assert
    expect(sql).toEqual(`with "temp_sales" as (select * from "sales" where "date" >= '2024-01-01')`);
});

test('with clause with multiple CTEs', () => {
    // Arrange
    const text = `WITH 
        sales_2024 AS (SELECT * FROM sales WHERE year = 2024),
        top_products AS (SELECT product_id, SUM(quantity) as total FROM sales_2024 GROUP BY product_id ORDER BY total DESC LIMIT 10)
    `;

    // Act
    const withClause = WithClauseParser.parse(text);
    const sql = formatter.format(withClause);

    // Assert
    expect(sql).toEqual(`with "sales_2024" as (select * from "sales" where "year" = 2024), "top_products" as (select "product_id", sum("quantity") as "total" from "sales_2024" group by "product_id" order by "total" desc limit 10)`);
});

test('with recursive clause', () => {
    // Arrange
    const text = `WITH RECURSIVE employees_path(id, name, path) AS (
        SELECT id, name, CAST(id AS TEXT) as path FROM employees WHERE manager_id IS NULL
        UNION ALL
        SELECT e.id, e.name, ep.path || '->' || CAST(e.id AS TEXT)
        FROM employees e JOIN employees_path ep ON e.manager_id = ep.id
    )`;

    // Act
    const withClause = WithClauseParser.parse(text);
    const sql = formatter.format(withClause);

    // Assert
    expect(sql).toEqual(`with recursive "employees_path"("id", "name", "path") as (select "id", "name", cast("id" as TEXT) as "path" from "employees" where "manager_id" is null union all select "e"."id", "e"."name", "ep"."path" || '->' || cast("e"."id" as TEXT) from "employees" as "e" join "employees_path" as "ep" on "e"."manager_id" = "ep"."id")`);
});

test('with clause with materialized CTEs', () => {
    // Arrange
    const text = `WITH 
        sales_summary AS MATERIALIZED (
            SELECT customer_id, SUM(amount) as total
            FROM sales
            GROUP BY customer_id
        ),
        customer_data AS NOT MATERIALIZED (
            SELECT c.*, s.total
            FROM customers c
            JOIN sales_summary s ON c.id = s.customer_id
        )
    `;

    // Act
    const withClause = WithClauseParser.parse(text);
    const sql = formatter.format(withClause);

    // Assert
    expect(sql).toEqual(`with "sales_summary" as materialized (select "customer_id", sum("amount") as "total" from "sales" group by "customer_id"), "customer_data" as not materialized (select "c".*, "s"."total" from "customers" as "c" join "sales_summary" as "s" on "c"."id" = "s"."customer_id")`);
});