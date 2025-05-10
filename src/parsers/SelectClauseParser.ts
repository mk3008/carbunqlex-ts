import { Distinct, DistinctComponent, DistinctOn, SelectClause, SelectItem } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class SelectClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): SelectClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The SELECT clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: SelectClause; newIndex: number } {
        let idx = index;
        let distinct: DistinctComponent | null = null;

        if (lexemes[idx].value !== 'select') {
            throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' keyword but found "${lexemes[idx].value}". SELECT clauses must start with the SELECT keyword.`);
        }
        idx++;

        if (idx < lexemes.length && lexemes[idx].value === 'distinct') {
            idx++;
            distinct = new Distinct();
        } else if (idx < lexemes.length && lexemes[idx].value === 'distinct on') {
            idx++;
            const argument = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            distinct = new DistinctOn(argument.value);
            idx = argument.newIndex;
        }

        const items: SelectItem[] = [];
        const item = SelectItemParser.parseItem(lexemes, idx);
        items.push(item.value);
        idx = item.newIndex;

        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++;
            const item = SelectItemParser.parseItem(lexemes, idx);
            items.push(item.value);
            idx = item.newIndex;
        }

        if (items.length === 0) {
            throw new Error(`Syntax error at position ${index}: No select items found. The SELECT clause requires at least one expression to select.`);
        } else {
            const clause = new SelectClause(items, distinct);
            return { value: clause, newIndex: idx };
        }
    }

}

// Extracted SelectItemParser for parsing individual select items
export class SelectItemParser {
    /**
     * Parses a single select item from a SQL string.
     * @param query The SQL string representing a select item (e.g. 'id as user_id').
     * @returns The parsed SelectItem instance.
     */
    public static parse(query: string): SelectItem {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();
        const result = this.parseItem(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The select item is complete but there are additional tokens.`);
        }
        return result.value;
    }

    /**
     * Parses a single select item from lexemes.
     * @param lexemes The array of lexemes.
     * @param index The starting index.
     * @returns An object containing the SelectItem and the new index.
     */
    public static parseItem(lexemes: Lexeme[], index: number): { value: SelectItem; newIndex: number } {
        let idx = index;
        const parsedValue = ValueParser.parseFromLexeme(lexemes, idx);
        const value = parsedValue.value;
        idx = parsedValue.newIndex;

        if (idx < lexemes.length && lexemes[idx].value === 'as') {
            // Skip 'AS' keyword
            idx++;
        }

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Identifier)) {
            const alias = lexemes[idx].value;
            idx++;
            return {
                value: new SelectItem(value, alias),
                newIndex: idx,
            };
        } else if (value instanceof ColumnReference && value.column.name !== "*") {
            // nameless select item
            return {
                value: new SelectItem(value, value.column.name),
                newIndex: idx,
            };
        }
        // nameless select item
        return {
            value: new SelectItem(value),
            newIndex: idx,
        };
    }
}