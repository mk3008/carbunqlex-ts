import { describe, it, expect, beforeAll } from 'vitest'; // Added beforeAll
import { PRESETS, SqlPrintTokenParser } from '../../src/parsers/SqlPrintTokenParser';
import { SqlPrinter } from '../../src/transformers/SqlPrinter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlPrintToken } from '../../src/models/SqlPrintToken'; // Added import for SqlPrintToken
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

// This test class is for SimpleSelectQuery printing only.
describe('SqlPrintTokenParser + SqlPrinter (SimpleSelectQuery)', () => {
    it('should print simple SELECT * FROM table', () => {
        // Arrange
        const node = SelectQueryParser.parse('select * from users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('select * from "users"');
    });

    it('should print SELECT with JOIN using USING clause (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select u.id, u.name, o.total ' +
            'from users u ' +
            'inner join orders o using (id)'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "u"."id"',
            '  , "u"."name"',
            '  , "o"."total"',
            'FROM',
            '  "users" AS "u"',
            '  INNER JOIN "orders" AS "o" USING("id")'
        ].join('\r\n'));
    });

    // Removed the original 'should print SELECT with columns' test as it's refactored below

    describe('Formatting "select id, name from users where age > 18 and (status = \'active\' or type = \'admin\')" with different styles', () => {
        const sqlInput = 'select id, name from users where age > 18 and (status = \'active\' or type = \'admin\')';
        let token: SqlPrintToken;

        beforeAll(() => {
            const node = SelectQueryParser.parse(sqlInput);
            const parser = new SqlPrintTokenParser();
            token = parser.visit(node);
        });

        it('should print as one-liner with appropriate options', () => {
            const printer = new SqlPrinter({
                newline: ' ', // Use space as newline for one-liner effect
                indentSize: 0, // No indentation for one-liner
                commaBreak: 'none' // Default, but explicit for clarity
            });
            const sql = printer.print(token);
            expect(sql).toBe('select "id", "name" from "users" where "age" > 18 and ("status" = \'active\' or "type" = \'admin\')');
        });

        it('should print with leading commas', () => {
            const printer = new SqlPrinter({
                commaBreak: 'before',
                indentSize: 2,
                indentChar: ' ',
                newline: '\r\n',
                keywordCase: 'upper',
                andBreak: 'before'
            });
            const sql = printer.print(token);
            expect(sql).toBe([
                'SELECT',
                '  "id"',
                '  , "name"',
                'FROM',
                '  "users"',
                'WHERE',
                '  "age" > 18',
                '  AND ("status" = \'active\' or "type" = \'admin\')'
            ].join('\r\n'));
        });

        it('should print with trailing commas', () => {
            const printer = new SqlPrinter({
                commaBreak: 'after',
                indentSize: 2,
                indentChar: ' ',
                newline: '\r\n',
                keywordCase: 'upper',
                andBreak: 'after'
            });
            const sql = printer.print(token);
            expect(sql).toBe([
                'SELECT',
                '  "id",',
                '  "name"',
                'FROM',
                '  "users"',
                'WHERE',
                '  "age" > 18 AND',
                '  ("status" = \'active\' or "type" = \'admin\')'
            ].join('\r\n'));
        });
    });

    // New describe block for DISTINCT queries
    describe('Formatting SELECT DISTINCT queries with specific style (leading comma, upper case, andBreak before)', () => {
        const printer = new SqlPrinter({
            commaBreak: 'before',
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            andBreak: 'before'
        });
        const parser = new SqlPrintTokenParser();

        it('should format SELECT DISTINCT columns with WHERE clause', () => {
            const sqlInput = 'select distinct id, name from users where age > 18 and type = \'user\'';
            const node = SelectQueryParser.parse(sqlInput);
            const token = parser.visit(node);
            const sql = printer.print(token);
            expect(sql).toBe([
                'SELECT DISTINCT',
                '  "id"',
                '  , "name"',
                'FROM',
                '  "users"',
                'WHERE',
                '  "age" > 18',
                '  AND "type" = \'user\''
            ].join('\r\n'));
        });

        it('should format SELECT DISTINCT ON (column) columns with ORDER BY', () => {
            // Note: This test depends on the parser\'s ability to handle DISTINCT ON.
            // If the parser does not specifically support DISTINCT ON, the output might differ.
            const sqlInput = 'select distinct on (status) id, name, status from users where age > 18 order by status, id desc';
            const node = SelectQueryParser.parse(sqlInput);
            const token = parser.visit(node);
            const sql = printer.print(token);
            // Expected output assumes DISTINCT ON is parsed and handled as a special construct.
            // The actual output will depend on how SqlPrintTokenParser structures tokens for DISTINCT ON.
            expect(sql).toBe([
                'SELECT DISTINCT ON("status")',
                '  "id"',
                '  , "name"',
                '  , "status"',
                'FROM',
                '  "users"',
                'WHERE',
                '  "age" > 18',
                'ORDER BY',
                '  "status"',
                '  , "id" DESC'
            ].join('\r\n'));
        });

        it('should format SELECT DISTINCT with a function call and GROUP BY/HAVING', () => {
            const sqlInput = 'select distinct count(id), status from users group by status having count(id) > 10';
            const node = SelectQueryParser.parse(sqlInput);
            const token = parser.visit(node);
            const sql = printer.print(token);
            expect(sql).toBe([
                'SELECT DISTINCT',
                '  count("id")',
                '  , "status"',
                'FROM',
                '  "users"',
                'GROUP BY',
                '  "status"',
                'HAVING',
                '  count("id") > 10'
            ].join('\r\n'));
        });
    });

    it('should print SELECT with WHERE', () => {
        // Arrange
        const node = SelectQueryParser.parse('select id from users where id = 1');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            'FROM',
            '  "users"',
            'WHERE',
            '  "id" = 1'
        ].join('\r\n'));
    });

    it('should print SELECT with multiple JOINs (indent 2)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select u.id, u.name, o.total, a.city ' +
            'from users u ' +
            'inner join orders o on u.id = o.user_id ' +
            'left join addresses a on u.id = a.user_id'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "u"."id"',
            '  , "u"."name"',
            '  , "o"."total"',
            '  , "a"."city"',
            'FROM',
            '  "users" AS "u"',
            '  INNER JOIN "orders" AS "o" ON "u"."id" = "o"."user_id"',
            '  LEFT JOIN "addresses" AS "a" ON "u"."id" = "a"."user_id"'
        ].join('\r\n'));
    });

    it('should print SELECT with LATERAL JOIN (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select u.id, t.max_total ' +
            'from users u ' +
            'left join lateral (select max(total) as max_total from orders o where o.user_id = u.id) t on true'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "u"."id"',
            '  , "t"."max_total"',
            'FROM',
            '  "users" AS "u"',
            '  LEFT JOIN LATERAL (',
            '    SELECT',
            '      max("total") AS "max_total"',
            '    FROM',
            '      "orders" AS "o"',
            '    WHERE',
            '      "o"."user_id" = "u"."id"',
            '  ) AS "t" ON true'
        ].join('\r\n'));
    });

    it('should print SELECT with OVER clause (window function, indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select id, salary, sum(salary) over (partition by department_id order by id) as total_salary ' +
            'from employees'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            '  , "salary"',
            '  , sum("salary") OVER(',
            '    PARTITION BY',
            '      "department_id"',
            '    ORDER BY',
            '      "id"',
            '  ) AS "total_salary"',
            'FROM',
            '  "employees"'
        ].join('\r\n'));
    });

    it('should print SELECT with LIMIT and OFFSET (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select id, name from users limit 10 offset 5'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            '  , "name"',
            'FROM',
            '  "users"',
            'LIMIT',
            '  10',
            'OFFSET',
            '  5'
        ].join('\r\n'));
    });

    it('should print SELECT with FOR UPDATE (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select id, name from users for update'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            '  , "name"',
            'FROM',
            '  "users"',
            'FOR UPDATE'
        ].join('\r\n'));
    });

    it('should print UNION query (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select id, name from users union select id, name from admins'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            '  , "name"',
            'FROM',
            '  "users"',
            'UNION',
            'SELECT',
            '  "id"',
            '  , "name"',
            'FROM',
            '  "admins"'
        ].join('\r\n'));
    });

    it('should print WITH clause (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'with t as (select id, name from users) select * from t'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'WITH',
            '  "t" AS (',
            '    SELECT',
            '      "id"',
            '      , "name"',
            '    FROM',
            '      "users"',
            '  )',
            'SELECT',
            '  *',
            'FROM',
            '  "t"'
        ].join('\r\n'));
    });

    it('should print WITH MATERIALIZED clause (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'with t as materialized (select id, name from users) select * from t'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'WITH',
            '  "t" AS MATERIALIZED (',
            '    SELECT',
            '      "id"',
            '      , "name"',
            '    FROM',
            '      "users"',
            '  )',
            'SELECT',
            '  *',
            'FROM',
            '  "t"'
        ].join('\r\n'));
    });
    it('should print VALUES query (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'values (1, 2), (3, 4)'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'VALUES',
            '  (1, 2)',
            '  , (3, 4)'
        ].join('\r\n'));
    });
    it('should print SELECT with named window clause (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select id, salary, sum(salary) over w as total_salary from employees window w as (partition by department_id order by id)'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  "id"',
            '  , "salary"',
            '  , sum("salary") OVER "w" AS "total_salary"',
            'FROM',
            '  "employees"',
            'WINDOW',
            '  "w" AS (',
            '    PARTITION BY',
            '      "department_id"',
            '    ORDER BY',
            '      "id"',
            '  )'
        ].join('\r\n'));
    });

    it('should print SELECT with function having multiple arguments', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            'select concat(first_name, \' \', last_name) as full_name from users'
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'SELECT',
            '  concat("first_name", \' \', "last_name") AS "full_name"',
            'FROM',
            '  "users"'
        ].join('\r\n'));
    });

    it('should print SELECT with named window clause (indent 2, leading comma)', () => {
        // Arrange
        const node = SelectQueryParser.parse(
            `
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
            `
        );
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe([
            'WITH',
            '  "dat"("line_id", "name", "unit_price", "quantity", "tax_rate") AS (',
            '    VALUES',
            '      (1, \'apple\', 105, 5, 0.07)',
            '      , (2, \'orange\', 203, 3, 0.07)',
            '      , (3, \'banana\', 233, 9, 0.07)',
            '      , (4, \'tea\', 309, 7, 0.08)',
            '      , (5, \'coffee\', 555, 9, 0.08)',
            '      , (6, \'matcha\', 456, 2, 0.08)',
            '  )',
            '  , "detail" AS (',
            '    SELECT',
            '      "q".*',
            '      , trunc("q"."price" * (1 + "q"."tax_rate")) - "q"."price" AS "tax"',
            '      , "q"."price" * (1 + "q"."tax_rate") - "q"."price" AS "raw_tax"',
            '    FROM',
            '      (',
            '        SELECT',
            '          "dat".*',
            '          , ("dat"."unit_price" * "dat"."quantity") AS "price"',
            '        FROM',
            '          "dat"',
            '      ) AS "q"',
            '  )',
            '  , "tax_summary" AS (',
            '    SELECT',
            '      "d"."tax_rate"',
            '      , trunc(sum("raw_tax")) AS "total_tax"',
            '    FROM',
            '      "detail" AS "d"',
            '    GROUP BY',
            '      "d"."tax_rate"',
            '  )',
            'SELECT',
            '  "line_id"',
            '  , "name"',
            '  , "unit_price"',
            '  , "quantity"',
            '  , "tax_rate"',
            '  , "price"',
            '  , "price" + "tax" AS "tax_included_price"',
            '  , "tax"',
            'FROM',
            '  (',
            '    SELECT',
            '      "line_id"',
            '      , "name"',
            '      , "unit_price"',
            '      , "quantity"',
            '      , "tax_rate"',
            '      , "price"',
            '      , "tax" + "adjust_tax" AS "tax"',
            '    FROM',
            '      (',
            '        SELECT',
            '          "q".*',
            '          , CASE WHEN "q"."total_tax" - "q"."cumulative" >= "q"."priority" THEN 1 ELSE 0 END AS "adjust_tax"',
            '        FROM',
            '          (',
            '            SELECT',
            '              "d".*',
            '              , "s"."total_tax"',
            '              , sum("d"."tax") OVER(',
            '                PARTITION BY',
            '                  "d"."tax_rate"',
            '              ) AS "cumulative"',
            '              , row_number() OVER(',
            '                PARTITION BY',
            '                  "d"."tax_rate"',
            '                ORDER BY',
            '                  "d"."raw_tax" % 1 DESC',
            '                  , "d"."line_id"',
            '              ) AS "priority"',
            '            FROM',
            '              "detail" AS "d"',
            '              INNER JOIN "tax_summary" AS "s" ON "d"."tax_rate" = "s"."tax_rate"',
            '          ) AS "q"',
            '      ) AS "q"',
            '  ) AS "q"',
            'ORDER BY',
            '  "line_id"'
        ].join('\r\n'));
    });

    it('should print SELECT with parameterized query using postgres style', () => {
        // Arrange
        const sqlText = 'select id, name from users where id = :id and status = :status';

        // Act
        const sql = SelectQueryParser.parse(sqlText);
        sql.setParameter('id', 1);
        sql.setParameter('status', 'active');

        const parser = new SqlPrintTokenParser({
            parameterSymbol: '@',
            identifierEscape: { start: '[', end: ']' },
            parameterStyle: "named"
        });
        const { token, params } = parser.parse(sql);

        const printer = new SqlPrinter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before',
        });
        const formattedSqlText = printer.print(token);

        // Assert
        expect(params).toEqual({
            id: 1,
            status: 'active'
        });

        expect(formattedSqlText).toBe([
            'SELECT',
            '  [id]',
            '  , [name]',
            'FROM',
            '  [users]',
            'WHERE',
            '  [id] = @id',
            '  AND [status] = @status'
        ].join('\r\n'));
    });

    it('SqlFormatter(default)', () => {
        // Arrange
        const sqlText = 'select id, name from users where id = :id and status = :status';

        // Act
        const sql = SelectQueryParser.parse(sqlText);
        sql.setParameter('id', 1);
        sql.setParameter('status', 'active');

        const formatter = new SqlFormatter();

        const result = formatter.format(sql);

        // Assert
        expect(result.params).toEqual({
            id: 1,
            status: 'active'
        });

        expect(result.formattedSql).toBe('select "id", "name" from "users" where "id" = :id and "status" = :status');
    });

    it('SqlFormatter(default)', () => {
        // Arrange
        const sqlText = 'select id, name from users where id = :id and status = :status';

        // Act
        const sql = SelectQueryParser.parse(sqlText);
        sql.setParameter('id', 1);
        sql.setParameter('status', 'active');

        const formatter = new SqlFormatter({
            preset: `sqlserver`, // Replace invalid PRESETS.SQLL with a valid preset name
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before',
        });

        const result = formatter.format(sql);

        // Assert
        expect(result.params).toEqual({
            id: 1,
            status: 'active'
        });

        expect(result.formattedSql).toBe([
            'SELECT',
            '  [id]',
            '  , [name]',
            'FROM',
            '  [users]',
            'WHERE',
            '  [id] = @id',
            '  AND [status] = @status'
        ].join('\r\n'));
    });
});
