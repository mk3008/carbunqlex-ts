import { JoinClause, SourceExpression } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { joinkeywordParser } from "../tokenReaders/CommandTokenReader";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { JoinOnClauseParser } from "./JoinOnClauseParser";
import { JoinUsingClauseParser } from "./JoinUsingClauseParser";

export class JoinClauseParser {
    public static tryParse(lexemes: Lexeme[], index: number): { value: JoinClause[]; newIndex: number } | null {
        let idx = index;
        const joins: JoinClause[] = [];

        while (this.isJoinCommand(lexemes, idx)) {
            const joinClause = this.parseJoinClause(lexemes, idx);
            joins.push(joinClause.value);
            idx = joinClause.newIndex;
        }

        if (joins.length > 0) {
            return { value: joins, newIndex: idx };
        }
        return null;
    }

    private static isJoinKeyword(value: string): boolean {
        // Although performance is not ideal,
        // we use keyword token reader to centralize keyword management
        const result = joinkeywordParser.parse(value, 0);
        if (result) {
            return true;
        }
        return false;
    }

    private static parseLateral(lexemes: Lexeme[], index: number): { value: boolean; newIndex: number } {
        let idx = index;

        if (idx < lexemes.length && lexemes[idx].value === 'lateral') {
            // Skip 'lateral' keyword
            idx++;
            return { value: true, newIndex: idx };
        }

        return { value: false, newIndex: idx };
    }

    private static isJoinCommand(lexemes: Lexeme[], index: number): boolean {
        if (index >= lexemes.length) {
            return false;
        }

        if (lexemes[index].type & TokenType.Comma || this.isJoinKeyword(lexemes[index].value) === true) {
            return true;
        }
        return false;
    }

    private static parseJoinClause(lexemes: Lexeme[], index: number): { value: JoinClause; newIndex: number } {
        let idx = index;

        // Get the join type
        const joinType = lexemes[idx].value === "," ? "cross join" : lexemes[idx].value;
        idx++;

        // Check for lateral join
        const lateralResult = this.parseLateral(lexemes, idx);
        const lateral = lateralResult.value;
        idx = lateralResult.newIndex;

        // Parse the source expression to join with
        const sourceResult = SourceExpressionParser.parseFromLexeme(lexemes, idx);
        idx = sourceResult.newIndex;


        if (idx < lexemes.length) {
            // JoinOnClauseParser
            const onResult = JoinOnClauseParser.tryParse(lexemes, idx);
            if (onResult) {
                const joinClause = new JoinClause(joinType, sourceResult.value, onResult.value, lateral);
                return { value: joinClause, newIndex: onResult.newIndex };
            }
            // JoinUsingClauseParser
            const usingResult = JoinUsingClauseParser.tryParse(lexemes, idx);
            if (usingResult) {
                const joinClause = new JoinClause(joinType, sourceResult.value, usingResult.value, lateral);
                return { value: joinClause, newIndex: usingResult.newIndex };
            }
        }

        // If we reach the end of the input, we can treat it as a natural join
        const joinClause = new JoinClause(joinType, sourceResult.value, null, lateral);
        return { value: joinClause, newIndex: idx };
    }
}