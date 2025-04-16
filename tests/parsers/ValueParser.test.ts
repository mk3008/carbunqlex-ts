import { describe, expect, test } from 'vitest';
import { ValueParser } from "../../src/parsers/ValueParser";
import { Formatter } from '../../src/transformers/Formatter';

// Changed test focus to avoid circular references during testing
describe('ValueParser', () => {
    const formatter = new Formatter();
    test.each([
        ["ColumnReference", "a.id", '"a"."id"'],
        ["ColumnReference - Wildcard", "*", "*"],
        ["ColumnReference - Table Wildcard", "c.*", '"c".*'],
        ["LiteralValue - Numeric", "123", "123"],
        ["LiteralValue - String", "'テスト文字列'", "'テスト文字列'"],
        ["LiteralValue - TRUE", "TRUE", "true"],
        ["LiteralValue - FALSE", "FALSE", "false"],
        ["LiteralValue - NULL", "NULL", "null"],
        ["BinaryExpression - Arithmetic operation", "a.id + 10", '"a"."id" + 10'],
        ["BinaryExpression - Multiple operators", "price * quantity - discount", '"price" * "quantity" - "discount"'],
        ["UnaryExpression - NOT operator", "NOT is_active", 'not "is_active"'],
        ["ParenExpression - Expression enclosed in parentheses", "(a + b) * c", '("a" + "b") * "c"'],
        ["FunctionCall - Single argument", "COUNT(id)", 'count("id")'],
        ["FunctionCall - Multiple arguments", "SUBSTRING(name, 1, 3)", 'substring("name", 1, 3)'],
        ["ParameterExpression - Parameter", "@userId", ":userId"],
        ["ArrayExpression - Array", "ARRAY[1, 2, 3]", "array[1, 2, 3]"],
        ["CASE - Simple CASE expression", "CASE age WHEN 18 THEN 'young' WHEN 65 THEN 'senior' ELSE 'adult' END", "case \"age\" when 18 then 'young' when 65 then 'senior' else 'adult' end"],
        ["CASE WHEN - Conditional branching", "CASE WHEN age > 18 THEN 'adult' ELSE 'minor' END", "case when \"age\" > 18 then 'adult' else 'minor' end"],
        ["BETWEEN - Range specification", "age BETWEEN 20 AND 30", '"age" between 20 and 30'],
        ["Complex expression - combination of multiple elements", "CASE WHEN a.status = 1 THEN upper(a.name) ELSE a.code || '-' || @suffix END", 'case when "a"."status" = 1 then upper("a"."name") else "a"."code" || \'-\' || :suffix end'],
        ["Logical operators - AND/OR", "a.flag = true AND (b.value > 10 OR c.status != 0)", '"a"."flag" = true and ("b"."value" > 10 or "c"."status" != 0)'],
        ["IN operator", "category_id IN (1, 2, 3)", '"category_id" in (1, 2, 3)'],
        ["IS operator", "a.value IS NULL", '"a"."value" is null'],
        ["IS DISTINCT FROM operator", "a.value IS DISTINCT FROM b.value", '"a"."value" is distinct from "b"."value"'],
        ["IS NOT DISTINCT FROM operator", "a.value IS NOT DISTINCT FROM b.value", '"a"."value" is not distinct from "b"."value"'],
        ["Unicode escape (U&'')", "U&'\\0041\\0042\\0043\\0044'", "U&'\\0041\\0042\\0043\\0044'"],
        ["LIKE escape - percent", "'a_b' LIKE 'a\\_b' ESCAPE '\\'", "'a_b' like 'a\\_b' escape '\\'"],
        ["EXTRACT - Extract month from timestamp", "EXTRACT(MONTH FROM '2025-03-21 12:34:56'::timestamp)", "extract(month from '2025-03-21 12:34:56'::timestamp)"],
        ["POSITION function", "POSITION('b' IN 'abc')", 'position(\'b\' in \'abc\')'],
        ["INTERVAL - Adding time interval", "INTERVAL '2 days' + INTERVAL '3 hours'", "interval '2 days' + interval '3 hours'"],
        ["SUBSTRING", "substring('Thomas', 2, 3)", "substring('Thomas', 2, 3)"],
        ["SUBSTRING with FROM and FOR", "substring('Thomas' from 2 for 3)", "substring('Thomas' from 2 for 3)"],
        ["SUBSTRING with only FROM", "substring('Thomas' from 3)", "substring('Thomas' from 3)"],
        ["SUBSTRING with only FOR", "substring('Thomas' for 2)", "substring('Thomas' for 2)"],
        ["SUBSTRING with FROM using regex pattern", "substring('Thomas' from '...$')", "substring('Thomas' from '...$')"],
        ["SUBSTRING with SIMILAR pattern", "substring('Thomas' similar '%#\"o_a#\"_' escape '#')", "substring('Thomas' similar '%#\"o_a#\"_' escape '#')"],
        ["TRIM", "trim('  yxTomxx  ')", "trim('  yxTomxx  ')"],
        ["TRIM with default BOTH and characters", "trim('xyz' from 'yxTomxx')", "trim('xyz' from 'yxTomxx')"],
        ["TRIM with explicit BOTH and characters", "trim(both 'xyz' from 'yxTomxx')", "trim(both 'xyz' from 'yxTomxx')"],
        ["TRIM with LEADING and characters", "trim(leading 'xyz' from 'yxTomxx')", "trim(leading 'xyz' from 'yxTomxx')"],
        ["TRIM with TRAILING and characters", "trim(trailing 'xyz' from 'yxTomxx')", "trim(trailing 'xyz' from 'yxTomxx')"],
        ["Postgres TRIM with LEADING from and characters", "trim(leading from 'yxTomxx', 'xyz')", "trim(leading from 'yxTomxx', 'xyz')"],
        ["Postgres TRIM with TRAILING from and characters", "trim(trailing from 'yxTomxx', 'xyz')", "trim(trailing from 'yxTomxx', 'xyz')"],
        ["Postgres TRIM with explicit BOTH from and characters", "trim(both from 'yxTomxx', 'xyz')", "trim(both from 'yxTomxx', 'xyz')"],
        ["Postgres TRIM with default BOTH and characters", "trim('yxTomxx', 'xyz')", "trim('yxTomxx', 'xyz')"],
        ["CAST with AS syntax", "CAST(id AS INTEGER)", "cast(\"id\" as INTEGER)"],
        ["CAST with precision", "CAST(price AS NUMERIC(10,2))", "cast(\"price\" as NUMERIC(10, 2))"],
        ["CAST with length", "CAST(name AS VARCHAR(50))", "cast(\"name\" as VARCHAR(50))"],
        ["Postgres CAST with AS syntax", "id::INTEGER", "\"id\"::INTEGER"],
        ["Postgres CAST with precision", "price::NUMERIC(10,2)", "\"price\"::NUMERIC(10, 2)"],
        ["Postgres CAST with length", "name::VARCHAR(50)", "\"name\"::VARCHAR(50)"],
        ["CAST with DOUBLE PRECISION", "value::DOUBLE PRECISION", "\"value\"::DOUBLE PRECISION"],
        ["CAST with CHARACTER VARYING", "text::CHARACTER VARYING(100)", "\"text\"::CHARACTER VARYING(100)"],
        ["CAST with TIME WITH TIME ZONE", "ts::TIME WITH TIME ZONE", "\"ts\"::TIME WITH TIME ZONE"],
        ["CAST with TIMESTAMP WITHOUT TIME ZONE", "date::TIMESTAMP WITHOUT TIME ZONE", "\"date\"::TIMESTAMP WITHOUT TIME ZONE"],
        ["OVERLAY function - basic", "OVERLAY('abcdef' PLACING 'xyz' FROM 2)", "overlay('abcdef' placing 'xyz' from 2)"],
        ["OVERLAY function - with FOR", "OVERLAY('abcdef' PLACING 'xyz' FROM 2 FOR 3)", "overlay('abcdef' placing 'xyz' from 2 for 3)"],
        ["AT TIME ZONE - basic", "current_timestamp AT TIME ZONE 'JST'", "current_timestamp at time zone 'JST'"],
        ["AT TIME ZONE - column reference", "created_at AT TIME ZONE 'UTC'", "\"created_at\" at time zone 'UTC'"],
        ["AT TIME ZONE - timestamp literal", "'2025-03-28 15:30:00'::timestamp AT TIME ZONE 'America/New_York'", "'2025-03-28 15:30:00'::timestamp at time zone 'America/New_York'"],
        ["AT TIME ZONE - nested", "('2025-03-28 15:30:00'::timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo'", "('2025-03-28 15:30:00'::timestamp at time zone 'UTC') at time zone 'Asia/Tokyo'"],
        ["Window function - simple OVER()", "row_number() OVER()", "row_number() over()"],
        ["Window function - with PARTITION BY", "rank() OVER(PARTITION BY department_id)", "rank() over(partition by \"department_id\")"],
        ["Window function - with ORDER BY", "dense_rank() OVER(ORDER BY salary DESC)", "dense_rank() over(order by \"salary\" desc)"],
        ["Window function - with PARTITION BY and ORDER BY", "sum(salary) OVER(PARTITION BY department_id ORDER BY hire_date)", "sum(\"salary\") over(partition by \"department_id\" order by \"hire_date\")"],
        ["Window function - with named window", "avg(salary) OVER w", "avg(\"salary\") over \"w\""],
        ["InlineQuery - Simple SELECT", "(SELECT id FROM users)", "(select \"id\" from \"users\")"],
        ["InlineQuery - With WHERE clause", "(SELECT name FROM products WHERE price > 100)", "(select \"name\" from \"products\" where \"price\" > 100)"],
        ["InlineQuery - In comparison", "user_id = (SELECT id FROM users WHERE name = 'Alice')", "\"user_id\" = (select \"id\" from \"users\" where \"name\" = 'Alice')"],
        ["InlineQuery - With aggregation", "department_id IN (SELECT dept_id FROM departments WHERE active = TRUE)", "\"department_id\" in (select \"dept_id\" from \"departments\" where \"active\" = true)"],
    ])('%s', (_, text, expected = text) => {
        const value = ValueParser.parseFromText(text);
        const sql = formatter.visit(value);
        //console.log(`plain   : ${text}\nexpected: ${expected}\nsql     : ${sql}`);
        expect(sql).toBe(expected);
    });
});
