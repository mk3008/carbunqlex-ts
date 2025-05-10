import { describe, expect, test } from 'vitest';
import { Formatter } from "../../src/transformers/Formatter";
import { FromClauseParser } from "../../src/parsers/FromClauseParser";

const formatter = new Formatter();

test('simple from', () => {
    // Arrange
    const text = `from users`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users"`);
});

test('from with table alias', () => {
    // Arrange
    const text = `from users u`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" as "u"`);
});

test('from with schema qualified table', () => {
    // Arrange
    const text = `from public.users`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "public"."users"`);
});

test('from with schema and alias', () => {
    // Arrange
    const text = `from public.users as u`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "public"."users" as "u"`);
});

test('from with inner join', () => {
    // Arrange
    const text = `from users u inner join orders o on u.id = o.user_id`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" as "u" inner join "orders" as "o" on "u"."id" = "o"."user_id"`);
});

test('from with left join', () => {
    // Arrange
    const text = `from users u left join orders o on u.id = o.user_id`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" as "u" left join "orders" as "o" on "u"."id" = "o"."user_id"`);
});

test('from with right join', () => {
    // Arrange
    const text = `from orders o right join users u on o.user_id = u.id`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "orders" as "o" right join "users" as "u" on "o"."user_id" = "u"."id"`);
});

test('from with full outer join', () => {
    // Arrange
    const text = `from users u full outer join orders o on u.id = o.user_id`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" as "u" full outer join "orders" as "o" on "u"."id" = "o"."user_id"`);
});

test('from with cross join', () => {
    // Arrange
    const text = `from products cross join categories`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "products" cross join "categories"`);
});

test('from with natural join', () => {
    // Arrange
    const text = `from employees natural join departments`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "employees" natural join "departments"`);
});

test('from with multiple joins', () => {
    // Arrange
    const text = `from orders o join users u on o.user_id = u.id join products p on o.product_id = p.id`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "orders" as "o" join "users" as "u" on "o"."user_id" = "u"."id" join "products" as "p" on "o"."product_id" = "p"."id"`);
});

// test('from with subquery', () => {
//     // Arrange
//     const text = `from (select * from users where active = true) as active_users`;

//     // Act
//     const clause = FromClauseParser.parse(text);
//     const sql = formatter.format(clause);

//     // Assert
//     expect(sql).toEqual(`from (select * from "users" where "active" = true) as "active_users"`);
// });

test('from with lateral join', () => {
    // Arrange
    const text = `from users u, lateral (select * from orders where user_id = u.id limit 3) as recent_orders`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" as "u" cross join lateral (select * from "orders" where "user_id" = "u"."id" limit 3) as "recent_orders"`);
});

test('from with column alias list', () => {
    // Arrange
    const text = `from users as u(user_id, username, email)`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" as "u"("user_id", "username", "email")`);
});

test('from with function', () => {
    // Arrange
    const text = `from generate_series(1, 10) as numbers`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from generate_series(1, 10) as "numbers"`);
});

test('from with namespaced function', () => {
    // Arrange
    const text = `from pg_catalog.generate_series(1, 10) as numbers`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "pg_catalog".generate_series(1, 10) as "numbers"`);
});

test('from with join using syntax', () => {
    // Arrange
    const text = `from users join orders using (id)`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" join "orders" using("id")`);
});

test('from with multiple columns in using clause', () => {
    // Arrange
    const text = `from users join orders using (user_id, order_date)`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" join "orders" using("user_id", "order_date")`);
});

test('from with left join lateral', () => {
    // Arrange
    const text = `from users u left join lateral (select * from orders o where o.user_id = u.id order by o.created_at desc limit 5) as recent_orders on true`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" as "u" left join lateral (select * from "orders" as "o" where "o"."user_id" = "u"."id" order by "o"."created_at" desc limit 5) as "recent_orders" on true`);
});

test('from with left join lateral without on clause', () => {
    // Arrange
    const text = `from users u left join lateral unnest(u.order_ids) as o(order_id)`;

    // Act
    const clause = FromClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`from "users" as "u" left join lateral unnest("u"."order_ids") as "o"("order_id")`);
});
