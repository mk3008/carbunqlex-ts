// --- FETCH句のテストケースは下のtest.each配列に追加するよ！ ---
import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';
import { ParameterStyle, PRESETS } from '../../src/parsers/SqlPrintTokenParser';

const formatter = new Formatter();

describe('SelectQueryParser', () => {
    test.each([
        ["Simple SELECT",
            "select id, name from users",
            'select "id", "name" from "users"'],

        ["SELECT with alias",
            "select u.id as user_id, u.name as user_name from users u",
            'select "u"."id" as "user_id", "u"."name" as "user_name" from "users" as "u"'],

        ["SELECT ALL fields with wildcard",
            "select * from products",
            'select * from "products"'],

        ["SELECT with WHERE condition",
            "select id, name from users where active = TRUE",
            'select "id", "name" from "users" where "active" = true'],

        ["SELECT with multiple WHERE conditions",
            "select id, name from users where age >= 18 and status = 'active'",
            'select "id", "name" from "users" where "age" >= 18 and "status" = \'active\''],

        ["SELECT with ORDER BY",
            "select id, name from users order by name",
            'select "id", "name" from "users" order by "name"'],

        ["SELECT with ORDER BY DESC",
            "select id, name from users order by name desc",
            'select "id", "name" from "users" order by "name" desc'],

        ["SELECT with LIMIT",
            "select id, name from users limit 10",
            'select "id", "name" from "users" limit 10'],

        ["SELECT with LIMIT and OFFSET",
            "select id, name from users limit 10 offset 5",
            'select "id", "name" from "users" limit 10 offset 5'],

        ["SELECT with GROUP BY",
            "select department, count(*) as employee_count from employees group by department",
            'select "department", count(*) as "employee_count" from "employees" group by "department"'],

        ["SELECT with GROUP BY and HAVING",
            "select department, count(*) as employee_count from employees group by department having count(*) > 5",
            'select "department", count(*) as "employee_count" from "employees" group by "department" having count(*) > 5'],

        ["SELECT with JOIN",
            "select u.name, o.total from users u join orders o on u.id = o.user_id",
            'select "u"."name", "o"."total" from "users" as "u" join "orders" as "o" on "u"."id" = "o"."user_id"'],

        ["SELECT with multiple JOINs",
            "select u.name, o.id, p.name as product_name from users u join orders o on u.id = o.user_id join products p on o.product_id = p.id",
            'select "u"."name", "o"."id", "p"."name" as "product_name" from "users" as "u" join "orders" as "o" on "u"."id" = "o"."user_id" join "products" as "p" on "o"."product_id" = "p"."id"'],

        ["SELECT with LEFT JOIN",
            "select u.name, o.total from users u left join orders o on u.id = o.user_id",
            'select "u"."name", "o"."total" from "users" as "u" left join "orders" as "o" on "u"."id" = "o"."user_id"'],

        ["SELECT with subquery in FROM",
            "select avg_data.avg_price from (select category, avg(price) as avg_price from products group by category) as avg_data",
            'select "avg_data"."avg_price" from (select "category", avg("price") as "avg_price" from "products" group by "category") as "avg_data"'],

        ["SELECT with subquery in WHERE",
            "select id, name from users where id in (select user_id from premium_subscriptions)",
            'select "id", "name" from "users" where "id" in (select "user_id" from "premium_subscriptions")'],

        ["SELECT with DISTINCT",
            "select distinct category from products",
            'select distinct "category" from "products"'],

        ["SELECT with DISTINCT ON",
            "select distinct on (department) id, name, salary from employees order by department, salary desc",
            'select distinct on("department") "id", "name", "salary" from "employees" order by "department", "salary" desc'],

        ["SELECT with window functions",
            "select date, value, avg(value) over(order by date rows between 2 preceding and current row) as moving_avg from stocks",
            'select "date", "value", avg("value") over(order by "date" rows between 2 preceding and current row) as "moving_avg" from "stocks"'],

        ["SELECT with window clause",
            "select id, value, avg(value) over w from measurements window w as (order by id rows between 2 preceding and 2 following)",
            'select "id", "value", avg("value") over "w" from "measurements" window "w" as (order by "id" rows between 2 preceding and 2 following)'],

        ["SELECT with FOR UPDATE clause",
            "select id, stock from products where id = 123 for update",
            'select "id", "stock" from "products" where "id" = 123 for update'],

        ["SELECT with FOR SHARE clause",
            "select id, balance from accounts where user_id = 456 for share",
            'select "id", "balance" from "accounts" where "user_id" = 456 for share'],

        ["SELECT with all basic clauses combined",
            "select distinct u.id, u.name, count(o.id) as order_count " +
            "from users u " +
            "left join orders o on u.id = o.user_id " +
            "where u.active = true " +
            "group by u.id, u.name " +
            "having count(o.id) > 0 " +
            "order by order_count desc " +
            "limit 10",
            'select distinct "u"."id", "u"."name", count("o"."id") as "order_count" from "users" as "u" left join "orders" as "o" on "u"."id" = "o"."user_id" where "u"."active" = true group by "u"."id", "u"."name" having count("o"."id") > 0 order by "order_count" desc limit 10'],

        ["SELECT with NOT NULL check",
            "select id, name from users where email is not null",
            'select "id", "name" from "users" where "email" is not null'],

        ["SELECT with BETWEEN",
            "select product_name, price from products where price between 10 and 50",
            'select "product_name", "price" from "products" where "price" between 10 and 50'],

        ["SELECT with EXISTS subquery",
            "select id, name from customers where exists (select 1 from orders where orders.customer_id = customers.id)",
            'select "id", "name" from "customers" where exists (select 1 from "orders" where "orders"."customer_id" = "customers"."id")'],

        ["SELECT with WITH clause (CTE)",
            "WITH monthly_sales AS (SELECT DATE_TRUNC('month', order_date) AS month, SUM(amount) AS total FROM orders GROUP BY month) SELECT month, total FROM monthly_sales ORDER BY month",
            'with "monthly_sales" as (select date_trunc(\'month\', "order_date") as "month", sum("amount") as "total" from "orders" group by "month") select "month", "total" from "monthly_sales" order by "month"'],

        ["SELECT with multiple CTEs",
            "WITH customers_2023 AS (SELECT * FROM customers WHERE join_date >= '2023-01-01'), customer_orders AS (SELECT c.id, c.name, COUNT(o.id) AS order_count FROM customers_2023 c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name) SELECT * FROM customer_orders WHERE order_count > 0 ORDER BY order_count DESC",
            'with "customers_2023" as (select * from "customers" where "join_date" >= \'2023-01-01\'), "customer_orders" as (select "c"."id", "c"."name", count("o"."id") as "order_count" from "customers_2023" as "c" left join "orders" as "o" on "c"."id" = "o"."customer_id" group by "c"."id", "c"."name") select * from "customer_orders" where "order_count" > 0 order by "order_count" desc'],

        ["SELECT with recursive CTE",
            "WITH RECURSIVE employee_hierarchy AS (SELECT id, name, manager_id, 1 AS level FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.id, e.name, e.manager_id, eh.level + 1 FROM employees e JOIN employee_hierarchy eh ON e.manager_id = eh.id) SELECT * FROM employee_hierarchy ORDER BY level, name",
            'with recursive "employee_hierarchy" as (select "id", "name", "manager_id", 1 as "level" from "employees" where "manager_id" is null union all select "e"."id", "e"."name", "e"."manager_id", "eh"."level" + 1 from "employees" as "e" join "employee_hierarchy" as "eh" on "e"."manager_id" = "eh"."id") select * from "employee_hierarchy" order by "level", "name"'],

        ["Simple VALUES query",
            "values (1, 'test', true)",
            "values (1, 'test', true)"],

        ["VALUES with multiple tuples",
            "values (1, 'apple', 0.99), (2, 'banana', 0.59), (3, 'orange', 0.79)",
            "values (1, 'apple', 0.99), (2, 'banana', 0.59), (3, 'orange', 0.79)"],

        ["VALUES with expressions",
            "values (1 + 2, concat('hello', ' ', 'world'), 5 * 10)",
            "values (1 + 2, concat('hello', ' ', 'world'), 5 * 10)"],

        ["SELECT UNION VALUES",
            "select id, name, price from products union values (100, 'New Product', 29.99)",
            'select "id", "name", "price" from "products" union values (100, \'New Product\', 29.99)'],

        ["VALUES UNION VALUES",
            "values (1, 'first'), (2, 'second') union values (3, 'third'), (4, 'fourth')",
            "values (1, 'first'), (2, 'second') union values (3, 'third'), (4, 'fourth')"],

        ["VALUES UNION SELECT",
            "values (1, 'test'), (2, 'sample') union select id, name from products where featured = true",
            'values (1, \'test\'), (2, \'sample\') union select "id", "name" from "products" where "featured" = true'],

        ["WITH clause with VALUES",
            "with sample_data as (values (1, 'apple'), (2, 'orange'), (3, 'banana')) select * from sample_data order by 2",
            'with "sample_data" as (values (1, \'apple\'), (2, \'orange\'), (3, \'banana\')) select * from "sample_data" order by 2'],

        ["WITH multiple CTEs with VALUES",
            "with fruits as (values (1, 'apple'), (2, 'orange')), vegetables as (values (3, 'carrot'), (4, 'potato')) select * from fruits union select * from vegetables",
            'with "fruits" as (values (1, \'apple\'), (2, \'orange\')), "vegetables" as (values (3, \'carrot\'), (4, \'potato\')) select * from "fruits" union select * from "vegetables"'],

        ["Subquery with VALUES in FROM",
            "select t.id, t.name from (values (1, 'apple'), (2, 'orange')) as t(id, name) where t.id > 1",
            'select "t"."id", "t"."name" from (values (1, \'apple\'), (2, \'orange\')) as "t"("id", "name") where "t"."id" > 1'],

        ["Subquery with VALUES in WHERE clause",
            "select id, name from products where (id, category) in (values (1, 'fruit'), (2, 'vegetable'))",
            'select "id", "name" from "products" where ("id", "category") in (values (1, \'fruit\'), (2, \'vegetable\'))'],

        ["WITH clause with VALUES and column aliases",
            "with sample_data(id, name) as (values (1, 'apple'), (2, 'orange'), (3, 'banana')) select * from sample_data order by 2",
            'with "sample_data"("id", "name") as (values (1, \'apple\'), (2, \'orange\'), (3, \'banana\')) select * from "sample_data" order by 2'],

        ["WITH multiple CTEs with VALUES and column aliases",
            "with fruits(id, name) as (values (1, 'apple'), (2, 'orange')), vegetables(id, name) as (values (3, 'carrot'), (4, 'potato')) select * from fruits union select * from vegetables",
            'with "fruits"("id", "name") as (values (1, \'apple\'), (2, \'orange\')), "vegetables"("id", "name") as (values (3, \'carrot\'), (4, \'potato\')) select * from "fruits" union select * from "vegetables"'],

        ["SELECT with template variable",
            "select ${name}",
            'select :name'],


        ["SELECT with FETCH FIRST ROW ONLY",
            "select id, name from users fetch first row only",
            'select "id", "name" from "users" fetch first 1 rows only'],

        ["SELECT with FETCH NEXT 5 ROWS ONLY",
            "select * from products fetch next 5 rows only",
            'select * from "products" fetch next 5 rows only'],

        ["SELECT with ORDER BY and FETCH",
            "select id, name from users order by id fetch first 10 rows only",
            'select "id", "name" from "users" order by "id" fetch first 10 rows only'],

        ["SELECT with OFFSET and FETCH",
            "select * from logs offset 20 rows fetch next 10 rows only",
            'select * from "logs" offset 20 fetch next 10 rows only'],

        ["SELECT with multiple named WINDOW clauses",
            "select id, value, avg(value) over w1, sum(value) over w2 from measurements window w1 as (partition by id), w2 as (order by value)",
            'select "id", "value", avg("value") over "w1", sum("value") over "w2" from "measurements" window "w1" as (partition by "id"), "w2" as (order by "value")'],

    ])('%s', (_, text, expected) => {
        // Parse the query
        const query = SelectQueryParser.parse(text);
        // Format it back to SQL
        const sql = formatter.format(query);
        // Verify it matches our expected output
        expect(sql).toBe(expected);
    });
});

// Add dedicated tests for VALUES clause
describe('SelectQueryParser with VALUES', () => {
    test('should throw an error when VALUES is malformed', () => {
        // Arrange
        const text = `values 1, 2, 3`;

        // Act & Assert
        expect(() => SelectQueryParser.parse(text)).toThrow(/Expected opening parenthesis/);
    });

    test('should throw an error when mixing VALUES and SELECT incorrectly', () => {
        // Arrange
        const text = `values (1, 2) select * from users`;

        // Act & Assert
        expect(() => SelectQueryParser.parse(text)).toThrow();
    });

    test('should handle complex UNION between VALUES and SELECT', () => {
        // Arrange
        const text = `values (1, 'Product A'), (2, 'Product B') union all select id, name from featured_products order by name`;

        // Act
        const query = SelectQueryParser.parse(text);
        const sql = formatter.format(query);

        // Assert
        expect(sql).toBe('values (1, \'Product A\'), (2, \'Product B\') union all select "id", "name" from "featured_products" order by "name"');
    });
});

describe('SelectQueryParser async', () => {
    test('parseAsync should resolve to same result as parse', async () => {
        // Arrange
        const sql = 'select id, name from users where active = TRUE';
        const expected = 'select "id", "name" from "users" where "active" = true';

        // Act
        const query = await SelectQueryParser.parseAsync(sql);
        const formatted = formatter.format(query);

        // Assert
        expect(formatted).toBe(expected);
    });

    test('parseAsync should reject on syntax error', async () => {
        // Arrange
        const sql = 'select from';

        // Act & Assert
        await expect(SelectQueryParser.parseAsync(sql)).rejects.toThrow();
    });

    test('Dialect conversion: Postgres to SQL Server', async () => {
        // Arrange
        const sql = 'select "id", "name" from "users" where "id" = :userId';
        const expected = 'select [id], [name] from [users] where [id] = @userId';

        // Act
        const query = await SelectQueryParser.parseAsync(sql);
        const formatted = formatter.format(query, { identifierEscape: { start: '[', end: ']' }, parameterSymbol: '@' });

        // Assert
        expect(formatted).toBe(expected);
    });

    test('Dialect conversion: Postgres to MySQL', async () => {
        // Arrange
        const sql = 'select "id", "name" from "users" where "id" = :userId';
        const expected = 'select `id`, `name` from `users` where `id` = ?';

        // Act
        const query = await SelectQueryParser.parseAsync(sql);
        const formatted = formatter.format(query, { identifierEscape: { start: '`', end: '`' }, parameterSymbol: '?', parameterStyle: ParameterStyle.Anonymous });

        // Assert
        expect(formatted).toBe(expected);
    });

    test('Dialect conversion: Postgres to Variable', async () => {
        // Arrange
        const sql = 'select "id", "name" from "users" where "id" = :userId';
        const expected = 'select "id", "name" from "users" where "id" = ${userId}';

        // Act
        const query = await SelectQueryParser.parseAsync(sql);
        // identifierEscape: { start: '"', end: '"' } is applied by default (Postgres style) if omitted
        const formatted = formatter.format(query, {
            parameterSymbol: { start: '${', end: '}' },
        });

        // Assert
        expect(formatted).toBe(expected);
    });

    test('Dialect conversion: Postgres to No Escape', async () => {
        // Arrange
        const sql = 'select "id", "name" from "users" where "id" = :userId';
        const expected = 'select id, name from users where id = :userId';

        // Act
        const query = await SelectQueryParser.parseAsync(sql);
        const formatted = formatter.format(query, {
            identifierEscape: { start: '', end: '' },
            parameterSymbol: ':'
        });

        // Assert
        expect(formatted).toBe(expected);
    });

    test('Dialect conversion: SQL Server to Postgres', async () => {
        // Arrange
        const sql = 'select [id], [name] from [users] where [id] = @userId';
        const expected = 'select "id", "name" from "users" where "id" = :userId';

        // Act
        const query = await SelectQueryParser.parseAsync(sql);
        const formatted = formatter.format(query, { identifierEscape: { start: '"', end: '"' }, parameterSymbol: ':' });

        // Assert
        expect(formatted).toBe(expected);
    });

    test('Dialect conversion: SQL Server to MySQL', async () => {
        // Arrange
        const sql = 'select [id], [name] from [users] where [id] = @userId';
        const expected = 'select `id`, `name` from `users` where `id` = ?';

        // Act
        const query = await SelectQueryParser.parseAsync(sql);
        const formatted = formatter.format(query, { identifierEscape: { start: '`', end: '`' }, parameterSymbol: '?', parameterStyle: ParameterStyle.Anonymous });

        // Assert
        expect(formatted).toBe(expected);
    });

    test('Dialect conversion: SQL Server to MySQL (using preset)', async () => {
        // Arrange
        const sql = 'select [id], [name] from [users] where [id] = @userId';
        const expected = 'select `id`, `name` from `users` where `id` = ?';

        // Act
        const query = await SelectQueryParser.parseAsync(sql);
        const formatted = formatter.format(query, PRESETS.mysql);

        // Assert
        expect(formatted).toBe(expected);
    });
});
