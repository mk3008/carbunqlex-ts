import { describe, test, expect } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { CommonTableParser } from '../../src/parsers/CommonTableParser';

const formatter = new Formatter();

test('simple common table', () => {
    // Arrange
    const text = `temp_sales AS (SELECT * FROM sales WHERE "date" >= '2024-01-01')`;

    // Act
    const commonTable = CommonTableParser.parse(text);
    const sql = formatter.format(commonTable);

    // Assert
    expect(sql).toEqual(`"temp_sales" as (select * from "sales" where "date" >= '2024-01-01')`);
});

test('common table with column aliases', () => {
    // Arrange
    const text = `temp_users(user_id, name, email) AS (SELECT id, full_name, email_address FROM users)`;

    // Act
    const commonTable = CommonTableParser.parse(text);
    const sql = formatter.format(commonTable);

    // Assert
    expect(sql).toEqual(`"temp_users"("user_id", "name", "email") as (select "id", "full_name", "email_address" from "users")`);
});

test('common table with MATERIALIZED', () => {
    // Arrange
    const text = `expensive_calc AS MATERIALIZED (SELECT user_id, COUNT(*) as count FROM orders GROUP BY user_id)`;

    // Act
    const commonTable = CommonTableParser.parse(text);
    const sql = formatter.format(commonTable);

    // Assert
    expect(sql).toEqual(`"expensive_calc" as materialized (select "user_id", count(*) as "count" from "orders" group by "user_id")`);
});

test('common table with NOT MATERIALIZED', () => {
    // Arrange
    const text = `summary AS NOT MATERIALIZED (SELECT department, AVG(salary) FROM employees GROUP BY department)`;

    // Act
    const commonTable = CommonTableParser.parse(text);
    const sql = formatter.format(commonTable);

    // Assert
    expect(sql).toEqual(`"summary" as not materialized (select "department", avg("salary") from "employees" group by "department")`);
});

test('common table with complex query', () => {
    // Arrange
    const text = `filtered_data AS (
        SELECT p.id, p.name, c.name AS category
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.price > 100
        ORDER BY p.name
        LIMIT 10
    )`;

    // Act
    const commonTable = CommonTableParser.parse(text);
    const sql = formatter.format(commonTable);

    // Assert
    expect(sql).toEqual(`"filtered_data" as (select "p"."id", "p"."name", "c"."name" as "category" from "products" as "p" join "categories" as "c" on "p"."category_id" = "c"."id" where "p"."price" > 100 order by "p"."name" limit 10)`);
});