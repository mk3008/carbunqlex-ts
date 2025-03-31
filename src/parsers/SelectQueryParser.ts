import { Lexeme } from "../models/Lexeme";
import { SelectQuery } from "../models/SelectQuery";
import { SelectClauseParser } from "./SelectClauseParser";
import { FromClauseParser } from "./FromClauseParser";
import { WhereClauseParser } from "./WhereClauseParser";
import { GroupByClauseParser } from "./GroupByParser";
import { HavingClauseParser } from "./HavingParser";
import { OrderByClauseParser } from "./OrderByClauseParser";
import { WindowClauseParser } from "./WindowClauseParser";
import { LimitClauseParser } from "./LimitClauseParser";
import { ForClauseParser } from "./ForClauseParser";
import { SqlTokenizer } from "./SqlTokenizer";
import { WithClauseParser } from "./WithClauseParser";

export class SelectQueryParser {
    public static parseFromText(query: string): SelectQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The SELECT query is complete but there are additional tokens.`);
        }

        return result.value;
    }

    public static parse(lexemes: Lexeme[], index: number): { value: SelectQuery; newIndex: number } {
        let idx = index;
        let withClauseResult = null;

        // Parse optional WITH clause
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'with') {
            withClauseResult = WithClauseParser.parse(lexemes, idx);
            idx = withClauseResult.newIndex;
        }

        // Parse SELECT clause (required)
        if (idx >= lexemes.length || lexemes[idx].value.toLowerCase() !== 'select') {
            throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' keyword but found "${idx < lexemes.length ? lexemes[idx].value : 'end of input'}". SELECT queries must start with the SELECT keyword.`);
        }

        const selectClauseResult = SelectClauseParser.parse(lexemes, idx);
        idx = selectClauseResult.newIndex;

        // Parse FROM clause (optional)
        let fromClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'from') {
            fromClauseResult = FromClauseParser.parse(lexemes, idx);
            idx = fromClauseResult.newIndex;
        }

        // Parse WHERE clause (optional)
        let whereClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'where') {
            whereClauseResult = WhereClauseParser.parse(lexemes, idx);
            idx = whereClauseResult.newIndex;
        }

        // Parse GROUP BY clause (optional)
        let groupByClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'group by') {
            groupByClauseResult = GroupByClauseParser.parse(lexemes, idx);
            idx = groupByClauseResult.newIndex;
        }

        // Parse HAVING clause (optional)
        let havingClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'having') {
            havingClauseResult = HavingClauseParser.parse(lexemes, idx);
            idx = havingClauseResult.newIndex;
        }

        // Parse WINDOW clause (optional)
        let windowFrameClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'window') {
            windowFrameClauseResult = WindowClauseParser.parse(lexemes, idx);
            idx = windowFrameClauseResult.newIndex;
        }

        // Parse ORDER BY clause (optional)
        let orderByClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'order by') {
            orderByClauseResult = OrderByClauseParser.parse(lexemes, idx);
            idx = orderByClauseResult.newIndex;
        }

        // Parse LIMIT clause (optional)
        let limitClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'limit') {
            limitClauseResult = LimitClauseParser.parse(lexemes, idx);
            idx = limitClauseResult.newIndex;
        }

        // Parse FOR clause (optional)
        let forClauseResult = null;
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === 'for') {
            forClauseResult = ForClauseParser.parse(lexemes, idx);
            idx = forClauseResult.newIndex;
        }

        // Create and return the SelectQuery object
        const selectQuery = new SelectQuery(
            withClauseResult ? withClauseResult.value : null,
            selectClauseResult.value,
            fromClauseResult ? fromClauseResult.value : null,
            whereClauseResult ? whereClauseResult.value : null,
            groupByClauseResult ? groupByClauseResult.value : null,
            havingClauseResult ? havingClauseResult.value : null,
            orderByClauseResult ? orderByClauseResult.value : null,
            windowFrameClauseResult ? windowFrameClauseResult.value : null,
            limitClauseResult ? limitClauseResult.value : null,
            forClauseResult ? forClauseResult.value : null
        );

        return { value: selectQuery, newIndex: idx };
    }
}