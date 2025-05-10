// filepath: src/parsers/InsertQueryParser.ts
// Provides parsing for INSERT queries, supporting optional columns and WITH/SELECT/VALUES structure.
import { InsertQuery } from "../models/InsertQuery";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { SelectQueryParser } from "./SelectQueryParser";
import { WithClause } from "../models/Clause";
import { WithClauseParser } from "./WithClauseParser";
import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { InsertClause } from "../models/Clause";

export class InsertQueryParser {
    /**
     * Parse SQL string to InsertQuery AST.
     * @param query SQL string
     */
    public static parse(query: string): InsertQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The INSERT query is complete but there are additional tokens.`);
        }
        return result.value;
    }

    /**
     * Parse from lexeme array (for internal use and tests)
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: InsertQuery; newIndex: number } {
        let idx = index;

        let withclause: WithClause | null = null;
        if (lexemes[idx].value === "with") {
            const result = WithClauseParser.parseFromLexeme(lexemes, idx);
            withclause = result.value;
            idx = result.newIndex;
        }

        // Expect INSERT INTO
        if (lexemes[idx].value !== "insert into") {
            throw new Error(`Syntax error at position ${idx}: Expected 'INSERT INTO' but found '${lexemes[idx].value}'.`);
        }
        idx++;

        // Parse table and optional alias/schema using SourceExpressionParser
        const sourceResult = SourceExpressionParser.parseTableSourceFromLexemes(lexemes, idx);
        idx = sourceResult.newIndex;

        // Optional columns
        let columns: string[] = [];
        if (lexemes[idx]?.type === TokenType.OpenParen) {
            idx++;
            while (idx < lexemes.length && lexemes[idx].type === TokenType.Identifier) {
                columns.push(lexemes[idx].value);
                idx++;
                if (lexemes[idx]?.type === TokenType.Comma) {
                    idx++;
                } else {
                    break;
                }
            }
            if (lexemes[idx]?.type !== TokenType.CloseParen) {
                throw new Error(`Syntax error at position ${idx}: Expected ')' after column list.`);
            }
            idx++;
        }

        const selectResult = SelectQueryParser.parseFromLexeme(lexemes, idx);
        if (withclause) {
            if (selectResult.value instanceof SimpleSelectQuery) {
                selectResult.value.withClause = withclause;
            } else {
                throw new Error(`WITH clause is not supported in this context.`);
            }
        }

        idx = selectResult.newIndex;
        return {
            value: new InsertQuery({
                insertClause: new InsertClause(sourceResult.value, columns),
                selectQuery: selectResult.value
            }),
            newIndex: idx
        };
    }
}
