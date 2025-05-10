import { JoinUsingClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ValueParser } from "./ValueParser";

export class JoinUsingClauseParser {
    public static tryParse(lexemes: Lexeme[], index: number): { value: JoinUsingClause; newIndex: number } | null {
        let idx = index;
        if (idx < lexemes.length && lexemes[idx].value === 'using') {
            idx++; // Skip 'using' keyword
            // Parse the columns in parentheses
            const result = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            const usingColumns = result.value;
            idx = result.newIndex;
            const joinUsing = new JoinUsingClause(usingColumns);
            return { value: joinUsing, newIndex: idx };
        }
        return null;
    }
}
