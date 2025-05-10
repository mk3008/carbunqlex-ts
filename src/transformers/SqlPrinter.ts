import { SqlPrintToken, SqlPrintTokenType, SqlPrintTokenContainerType } from "../models/SqlPrintToken";
import { IndentCharOption, LinePrinter, NewlineOption } from "./LinePrinter";

/**
 * CommaBreakStyle determines how commas are placed in formatted SQL output.
 * - 'none': No line break for commas
 * - 'before': Line break before comma
 * - 'after': Line break after comma
 */
export type CommaBreakStyle = 'none' | 'before' | 'after';

/**
 * AndBreakStyle determines how AND operators are placed in formatted SQL output.
 * - 'none': No line break for AND
 * - 'before': Line break before AND
 * - 'after': Line break after AND
 */
export type AndBreakStyle = 'none' | 'before' | 'after';

/**
 * SqlPrinter formats a SqlPrintToken tree into a SQL string with flexible style options.
 */
export class SqlPrinter {
    /** Indent character (e.g., ' ' or '\\t') */
    indentChar: IndentCharOption; // Changed type from string
    /** Indent size (number of indentChar repetitions per level) */
    indentSize: number;
    /** Newline character (e.g., '\\n' or '\\r\\n') */
    newline: NewlineOption; // Changed type from string
    /** Comma break style: 'none', 'before', or 'after' */
    commaBreak: CommaBreakStyle;
    /** AND break style: 'none', 'before', or 'after' */
    andBreak: AndBreakStyle;

    /** Keyword case style: 'none', 'upper' | 'lower' */
    keywordCase: 'none' | 'upper' | 'lower';

    private linePrinter: LinePrinter;
    private indentIncrementContainers: Set<SqlPrintTokenContainerType>;

    /**
     * @param options Optional style settings for pretty printing
     */
    constructor(options?: {
        indentChar?: IndentCharOption;
        indentSize?: number;
        newline?: NewlineOption;
        commaBreak?: CommaBreakStyle;
        andBreak?: AndBreakStyle;
        keywordCase?: 'none' | 'upper' | 'lower';
        indentIncrementContainerTypes?: string[]; // Option to customize
    }) {
        this.indentChar = options?.indentChar ?? '';
        this.indentSize = options?.indentSize ?? 0;

        // The default newline character is set to a blank space (' ') to enable one-liner formatting.
        // This is intentional and differs from the LinePrinter default of '\r\n'.
        this.newline = options?.newline ?? ' ';

        this.commaBreak = options?.commaBreak ?? 'none';
        this.andBreak = options?.andBreak ?? 'none';
        this.keywordCase = options?.keywordCase ?? 'none';
        this.linePrinter = new LinePrinter(this.indentChar, this.indentSize, this.newline);

        // Initialize
        this.indentIncrementContainers = new Set(
            (options?.indentIncrementContainerTypes as SqlPrintTokenContainerType[] | undefined) ?? [
                SqlPrintTokenContainerType.SelectClause,
                SqlPrintTokenContainerType.FromClause,
                SqlPrintTokenContainerType.WhereClause,
                SqlPrintTokenContainerType.GroupByClause,
                SqlPrintTokenContainerType.HavingClause,
                SqlPrintTokenContainerType.WindowFrameExpression,
                SqlPrintTokenContainerType.PartitionByClause,
                SqlPrintTokenContainerType.OrderByClause,
                SqlPrintTokenContainerType.WindowClause,
                SqlPrintTokenContainerType.LimitClause,
                SqlPrintTokenContainerType.OffsetClause,
                SqlPrintTokenContainerType.SubQuerySource,
                SqlPrintTokenContainerType.BinarySelectQueryOperator,
                SqlPrintTokenContainerType.Values,
                SqlPrintTokenContainerType.WithClause
                //SqlPrintTokenContainerType.CommonTable
            ]
        );
    }

    /**
     * Converts a SqlPrintToken tree to a formatted SQL string.
     * @param token The root SqlPrintToken
     * @param level Indentation level (default: 0)
     */
    print(token: SqlPrintToken, level: number = 0): string {
        // initialize
        this.linePrinter = new LinePrinter(this.indentChar, this.indentSize, this.newline);
        if (this.linePrinter.lines.length > 0 && level !== this.linePrinter.lines[0].level) {
            this.linePrinter.lines[0].level = level;
        }

        this.appendToken(token, level);

        return this.linePrinter.print();
    }

    private appendToken(token: SqlPrintToken, level: number) {
        if (!token.innerTokens || token.innerTokens.length === 0) {
            if (token.text === '') {
                return;
            }
        }

        const current = this.linePrinter.getCurrentLine();

        if (token.type === SqlPrintTokenType.keyword) {
            let text = token.text;
            if (this.keywordCase === 'upper') {
                text = text.toUpperCase();
            } else if (this.keywordCase === 'lower') {
                text = text.toLowerCase();
            }
            this.linePrinter.appendText(text);
        } else if (token.type === SqlPrintTokenType.comma) {
            let text = token.text;
            if (this.commaBreak === 'before') {
                this.linePrinter.appendNewline(level);
                this.linePrinter.appendText(text);
            } else if (this.commaBreak === 'after') {
                this.linePrinter.appendText(text);
                this.linePrinter.appendNewline(level);
            } else {
                this.linePrinter.appendText(text);
            }
        } else if (token.type === SqlPrintTokenType.operator && token.text.toLowerCase() === 'and') {
            let text = token.text;
            if (this.keywordCase === 'upper') {
                text = text.toUpperCase();
            } else if (this.keywordCase === 'lower') {
                text = text.toLowerCase();
            }

            if (this.andBreak === 'before') {
                this.linePrinter.appendNewline(level);
                this.linePrinter.appendText(text);
            } else if (this.andBreak === 'after') {
                this.linePrinter.appendText(text);
                this.linePrinter.appendNewline(level);
            } else {
                this.linePrinter.appendText(text);
            }
        } else if (token.containerType === "JoinClause") {
            let text = token.text;
            if (this.keywordCase === 'upper') {
                text = text.toUpperCase();
            } else if (this.keywordCase === 'lower') {
                text = text.toLowerCase();
            }
            // before join clause, add newline
            this.linePrinter.appendNewline(level);
            this.linePrinter.appendText(text);
        } else {
            this.linePrinter.appendText(token.text);
        }

        // append keyword tokens(not indented)
        if (token.keywordTokens && token.keywordTokens.length > 0) {
            for (let i = 0; i < token.keywordTokens.length; i++) {
                const keywordToken = token.keywordTokens[i];
                this.appendToken(keywordToken, level);
            }
        }

        let innerLevel = level;

        // indnet level up
        if (this.newline !== ' ' && current.text !== '' && this.indentIncrementContainers.has(token.containerType)) { // Changed condition
            innerLevel++;
            this.linePrinter.appendNewline(innerLevel);
        }

        for (let i = 0; i < token.innerTokens.length; i++) {
            const child = token.innerTokens[i];
            this.appendToken(child, innerLevel);
        }

        // indnet level down
        if (innerLevel !== level) {
            this.linePrinter.appendNewline(level);
        }
    }
}