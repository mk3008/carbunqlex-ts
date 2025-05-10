import { describe, test, expect } from 'vitest';
import { Formatter } from "../../src/transformers/Formatter";
import { WindowExpressionParser } from "../../src/parsers/WindowExpressionParser";

const formatter = new Formatter();

test('empty window frame', () => {
    // Arrange
    const text = `()`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(``);
    expect(expression.partition).toBeNull();
    expect(expression.order).toBeNull();
});

test('window frame with partition by', () => {
    // Arrange
    const text = `(partition by department_id)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`partition by "department_id"`);
    expect(expression.partition).not.toBeNull();
    expect(expression.order).toBeNull();
});

test('window frame with order by', () => {
    // Arrange
    const text = `(order by salary desc)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`order by "salary" desc`);
    expect(expression.partition).toBeNull();
    expect(expression.order).not.toBeNull();
});

test('window frame with partition by and order by', () => {
    // Arrange
    const text = `(partition by department_id order by salary desc)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`partition by "department_id" order by "salary" desc`);
    expect(expression.partition).not.toBeNull();
    expect(expression.order).not.toBeNull();
});

test('window frame with multiple partition by columns', () => {
    // Arrange
    const text = `(partition by department_id, location_id)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`partition by "department_id", "location_id"`);
});

test('window frame with multiple order by columns', () => {
    // Arrange
    const text = `(order by department_id, salary desc)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`order by "department_id", "salary" desc`);
});

test('window frame with expression in partition by', () => {
    // Arrange
    const text = `(partition by extract(year from hire_date))`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`partition by extract(year from "hire_date")`);
});

test('error on missing opening parenthesis', () => {
    // Arrange
    const text = `partition by department_id)`;

    // Act & Assert
    expect(() => WindowExpressionParser.parse(text)).toThrow();
});

test('error on missing closing parenthesis', () => {
    // Arrange
    const text = `(partition by department_id`;

    // Act & Assert
    expect(() => WindowExpressionParser.parse(text)).toThrow();
});

test('error on invalid order in window frame', () => {
    // Arrange
    const text = `(order by department_id partition by salary)`;

    // Act & Assert
    // partition by cannot come after order by and will cause an error
    expect(() => WindowExpressionParser.parse(text)).toThrow();
});

test('window frame with rows specification', () => {
    // Arrange
    const text = `(rows current row)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`rows current row`);
    expect(expression.frameSpec).not.toBeNull();
});

test('window frame with range specification', () => {
    // Arrange
    const text = `(range unbounded preceding)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`range unbounded preceding`);
    expect(expression.frameSpec).not.toBeNull();
});

test('window frame with groups specification', () => {
    // Arrange
    const text = `(groups 3 preceding)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`groups 3 preceding`);
    expect(expression.frameSpec).not.toBeNull();
});

test('window frame with rows between specification', () => {
    // Arrange
    const text = `(rows between unbounded preceding and current row)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`rows between unbounded preceding and current row`);
    expect(expression.frameSpec).not.toBeNull();
});

test('window frame with range between specification', () => {
    // Arrange
    const text = `(range between 3 preceding and 3 following)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`range between 3 preceding and 3 following`);
    expect(expression.frameSpec).not.toBeNull();
});

test('window frame with complete window specification', () => {
    // Arrange
    const text = `(partition by department_id order by salary desc rows between unbounded preceding and current row)`;

    // Act
    const expression = WindowExpressionParser.parse(text);
    const sql = formatter.format(expression);

    // Assert
    expect(sql).toEqual(`partition by "department_id" order by "salary" desc rows between unbounded preceding and current row`);
    expect(expression.partition).not.toBeNull();
    expect(expression.order).not.toBeNull();
    expect(expression.frameSpec).not.toBeNull();
});

test('error on invalid frame boundary', () => {
    // Arrange
    const text = `(rows unknown_boundary)`;

    // Act & Assert
    expect(() => WindowExpressionParser.parse(text)).toThrow();
});

test('error on missing AND in BETWEEN clause', () => {
    // Arrange
    const text = `(rows between unbounded preceding current row)`;

    // Act & Assert
    expect(() => WindowExpressionParser.parse(text)).toThrow();
});