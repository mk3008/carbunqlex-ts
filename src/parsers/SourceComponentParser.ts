import { FunctionSource, SourceComponent, SubQuerySource, TableSource } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SelectQueryParser } from "./SelectQueryParser";
import { ValueParser } from "./ValueParser";

export class SourceParser {

    public static parse(lexemes: Lexeme[], index: number): { value: SourceComponent; newIndex: number } {
        const idx = index;

        // Handle subquery
        if (idx < lexemes.length && lexemes[idx].type === TokenType.OpenParen) {
            return this.parseParenSource(lexemes, idx);
        }

        // Handle function-based source
        if (idx < lexemes.length && lexemes[idx].type === TokenType.Function) {
            return this.parseFunctionSource(lexemes, idx);
        }

        // Handle table source (regular table, potentially schema-qualified)
        return this.parseTableSource(lexemes, idx);
    }

    private static parseTableSource(lexemes: Lexeme[], index: number): { value: TableSource; newIndex: number } {
        // Check for column reference pattern ([identifier dot] * n + identifier)
        let idx = index;
        const identifiers: string[] = [];

        // Add the first identifier
        identifiers.push(lexemes[idx].value);
        idx++;

        // Look for dot and identifier pattern
        while (
            idx < lexemes.length &&
            idx + 1 < lexemes.length &&
            lexemes[idx].type === TokenType.Dot &&
            lexemes[idx + 1].type === TokenType.Identifier
        ) {
            // Skip the dot and add the next identifier
            idx++;
            identifiers.push(lexemes[idx].value);
            idx++;
        }

        if (identifiers.length > 1) {
            // If there are multiple identifiers, treat it as a column reference
            const lastIdentifier = identifiers.pop() || '';
            const value = new TableSource(identifiers, lastIdentifier);
            return { value, newIndex: idx };
        } else {
            // If there is a single identifier, treat it as a simple identifier
            const value = new TableSource(null, identifiers[0]);
            return { value, newIndex: idx };
        }
    }

    private static parseFunctionSource(lexemes: Lexeme[], index: number): { value: FunctionSource; newIndex: number } {
        let idx = index;
        const functionName = lexemes[idx].value;
        idx++;

        const argument = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
        idx = argument.newIndex;

        const result = new FunctionSource(functionName, argument.value);
        return { value: result, newIndex: idx };
    }

    private static parseParenSource(lexemes: Lexeme[], index: number): { value: SourceComponent; newIndex: number } {
        let idx = index;
        // skip the open parenthesis
        idx++;
        if (idx >= lexemes.length) {
            throw new Error(`Unexpected end of input at index ${idx}`);
        }

        if (lexemes[idx].value == "select") {
            const result = this.parseSubQuerySource(lexemes, idx);
            idx = result.newIndex;
            if (idx < lexemes.length && lexemes[idx].type == TokenType.CloseParen) {
                // skip the closing parenthesis
                idx++;
            } else {
                throw new Error(`Expected closing parenthesis at index ${idx}`);
            }
            return { value: result.value, newIndex: idx };
        } else if (lexemes[idx].type == TokenType.OpenParen) {
            const result = this.parseParenSource(lexemes, idx);
            idx = result.newIndex;
            if (idx < lexemes.length && lexemes[idx].type == TokenType.CloseParen) {
                // skip the closing parenthesis
                idx++;
            } else {
                throw new Error(`Expected closing parenthesis at index ${idx}`);
            }
            return { value: result.value, newIndex: idx };
        }

        throw new Error(`Expected 'SELECT' or '(' at index ${idx}`);
    }

    private static parseSubQuerySource(lexemes: Lexeme[], index: number): { value: SubQuerySource; newIndex: number } {
        let idx = index;

        const selectQuery = SelectQueryParser.parse(lexemes, idx);
        idx = selectQuery.newIndex;

        const subQuerySource = new SubQuerySource(selectQuery.value);
        return { value: subQuerySource, newIndex: idx };
    }
}
