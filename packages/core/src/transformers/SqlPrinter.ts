import { SqlPrintToken, SqlPrintTokenType, SqlPrintTokenContainerType } from "../models/SqlPrintToken";
import { IndentCharOption, LinePrinter, NewlineOption } from "./LinePrinter";
import { CTEDependencyTracer } from "./CTEDependencyTracer";

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
 * Options for configuring SqlPrinter formatting behavior
 */
export interface SqlPrinterOptions {
    /** Indent character (e.g., ' ' or '\t') */
    indentChar?: IndentCharOption;
    /** Indent size (number of indentChar repetitions per level) */
    indentSize?: number;
    /** Newline character (e.g., '\n' or '\r\n') */
    newline?: NewlineOption;
    /** Comma break style: 'none', 'before', or 'after' */
    commaBreak?: CommaBreakStyle;
    /** AND break style: 'none', 'before', or 'after' */
    andBreak?: AndBreakStyle;
    /** Keyword case style: 'none', 'upper' | 'lower' */
    keywordCase?: 'none' | 'upper' | 'lower';
    /** Whether to export comments in the output (default: false for compatibility) */
    exportComment?: boolean;
    /** Whether to use strict comment placement (only clause-level comments, default: false) */
    strictCommentPlacement?: boolean;
    /** Container types that should increase indentation level */
    indentIncrementContainerTypes?: SqlPrintTokenContainerType[];
    /** Whether to format CTE parts as one-liners (default: false) */
    cteOneline?: boolean;
    /** Whether to format CTE parts as one-liners based on dependencies (default: false) */
    cteOnelineDependency?: boolean;
    /** Set of CTE names that should be formatted as oneline (computed externally) */
    cteOnelineSet?: Set<string>;
    /** Import comments to be added after WITH clause */
    importComments?: string[];
}

/**
 * SqlPrinter formats a SqlPrintToken tree into a SQL string with flexible style options.
 * 
 * This class provides various formatting options including:
 * - Indentation control (character and size)
 * - Line break styles for commas and AND operators
 * - Keyword case transformation
 * - Comment handling
 * - CTE (Common Table Expression) formatting
 * 
 * @example
 * const printer = new SqlPrinter({
 *   indentChar: '  ',
 *   indentSize: 1,
 *   keywordCase: 'upper',
 *   commaBreak: 'after'
 * });
 * const formatted = printer.print(sqlToken);
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

    /** Whether to export comments in the output (default: false for compatibility) */
    exportComment: boolean;

    /** Whether to use strict comment placement (only clause-level comments, default: false) */
    strictCommentPlacement: boolean;

    /** Whether to format CTE parts as one-liners (default: false) */
    cteOneline: boolean;
    
    /** Whether to format CTE parts as one-liners based on dependencies (default: false) */
    cteOnelineDependency: boolean;

    /** Set of CTE names that should be formatted as oneline based on dependency analysis */
    private cteOnelineSet: Set<string>;

    /** Import comments to be added after WITH clause */
    private importComments: string[];

    private linePrinter: LinePrinter;
    private indentIncrementContainers: Set<SqlPrintTokenContainerType>;

    /**
     * @param options Optional style settings for pretty printing
     */
    constructor(options?: SqlPrinterOptions) {
        this.indentChar = options?.indentChar ?? '';
        this.indentSize = options?.indentSize ?? 0;

        // The default newline character is set to a blank space (' ') to enable one-liner formatting.
        // This is intentional and differs from the LinePrinter default of '\r\n'.
        this.newline = options?.newline ?? ' ';

        this.commaBreak = options?.commaBreak ?? 'none';
        this.andBreak = options?.andBreak ?? 'none';
        this.keywordCase = options?.keywordCase ?? 'none';
        this.exportComment = options?.exportComment ?? false;
        this.strictCommentPlacement = options?.strictCommentPlacement ?? false;
        this.cteOneline = options?.cteOneline ?? false;
        this.cteOnelineDependency = options?.cteOnelineDependency ?? false;
        this.cteOnelineSet = options?.cteOnelineSet ?? new Set();
        this.importComments = options?.importComments ?? [];
        this.linePrinter = new LinePrinter(this.indentChar, this.indentSize, this.newline);

        // Initialize
        this.indentIncrementContainers = new Set(
            options?.indentIncrementContainerTypes ?? [
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
                SqlPrintTokenContainerType.BinarySelectQueryOperator, SqlPrintTokenContainerType.Values,
                SqlPrintTokenContainerType.WithClause,
                SqlPrintTokenContainerType.SwitchCaseArgument,
                SqlPrintTokenContainerType.CaseKeyValuePair,
                SqlPrintTokenContainerType.CaseThenValue,
                SqlPrintTokenContainerType.ElseClause,
                SqlPrintTokenContainerType.CaseElseValue
                // CaseExpression, SwitchCaseArgument, CaseKeyValuePair, and ElseClause
                // are not included by default to maintain backward compatibility with tests
                //SqlPrintTokenContainerType.CommonTable
            ]
        );
    }

    /**
     * Converts a SqlPrintToken tree to a formatted SQL string.
     * @param token The root SqlPrintToken to format
     * @param level Initial indentation level (default: 0)
     * @returns Formatted SQL string
     * @example
     * const printer = new SqlPrinter({ indentChar: '  ', keywordCase: 'upper' });
     * const formatted = printer.print(sqlToken);
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

    private appendToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType) {
        if (this.shouldSkipToken(token)) {
            return;
        }

        const current = this.linePrinter.getCurrentLine();

        // Handle different token types        
        if (token.containerType === SqlPrintTokenContainerType.WithClause && this.importComments.length > 0) {
            this.handleWithClauseToken(token, level);
            return; // Return early to avoid processing innerTokens
        } else if (token.type === SqlPrintTokenType.keyword) {
            this.handleKeywordToken(token, level);
        } else if (token.type === SqlPrintTokenType.comma) {
            this.handleCommaToken(token, level, parentContainerType);
        } else if (token.type === SqlPrintTokenType.operator && token.text.toLowerCase() === 'and') {
            this.handleAndOperatorToken(token, level);
        } else if (token.containerType === "JoinClause") {
            this.handleJoinClauseToken(token, level);
        } else if (token.type === SqlPrintTokenType.comment) {
            this.handleCommentToken(token);
        } else if (token.containerType === SqlPrintTokenContainerType.CommonTable && this.shouldFormatCteOneline(token)) {
            this.handleCteOnelineToken(token, level);
            return; // Return early to avoid processing innerTokens
        } else {
            this.linePrinter.appendText(token.text);
        }

        // append keyword tokens(not indented)
        if (token.keywordTokens && token.keywordTokens.length > 0) {
            for (let i = 0; i < token.keywordTokens.length; i++) {
                const keywordToken = token.keywordTokens[i];
                this.appendToken(keywordToken, level, token.containerType);
            }
        }

        let innerLevel = level;

        // indent level up
        if (this.newline !== ' ' && current.text !== '' && this.indentIncrementContainers.has(token.containerType)) { // Changed condition
            innerLevel++;
            this.linePrinter.appendNewline(innerLevel);
        }

        for (let i = 0; i < token.innerTokens.length; i++) {
            const child = token.innerTokens[i];
            this.appendToken(child, innerLevel, token.containerType);
        }

        // indent level down
        if (innerLevel !== level) {
            this.linePrinter.appendNewline(level);
        }
    }

    private shouldSkipToken(token: SqlPrintToken): boolean {
        return (!token.innerTokens || token.innerTokens.length === 0) && token.text === '';
    }

    private applyKeywordCase(text: string): string {
        if (this.keywordCase === 'upper') {
            return text.toUpperCase();
        } else if (this.keywordCase === 'lower') {
            return text.toLowerCase();
        }
        return text;
    }

    private handleKeywordToken(token: SqlPrintToken, level: number): void {
        const text = this.applyKeywordCase(token.text);
        this.linePrinter.appendText(text);
    }

    private handleCommaToken(token: SqlPrintToken, level: number, parentContainerType?: SqlPrintTokenContainerType): void {
        const text = token.text;
        
        // Special handling for commas in WithClause when cteOneline is enabled
        if (this.cteOneline && parentContainerType === SqlPrintTokenContainerType.WithClause) {
            this.linePrinter.appendText(text);
            this.linePrinter.appendNewline(level);
        } else if (this.commaBreak === 'before') {
            this.linePrinter.appendNewline(level);
            this.linePrinter.appendText(text);
        } else if (this.commaBreak === 'after') {
            this.linePrinter.appendText(text);
            this.linePrinter.appendNewline(level);
        } else {
            this.linePrinter.appendText(text);
        }
    }

    private handleAndOperatorToken(token: SqlPrintToken, level: number): void {
        const text = this.applyKeywordCase(token.text);
        
        if (this.andBreak === 'before') {
            this.linePrinter.appendNewline(level);
            this.linePrinter.appendText(text);
        } else if (this.andBreak === 'after') {
            this.linePrinter.appendText(text);
            this.linePrinter.appendNewline(level);
        } else {
            this.linePrinter.appendText(text);
        }
    }

    private handleJoinClauseToken(token: SqlPrintToken, level: number): void {
        const text = this.applyKeywordCase(token.text);
        // before join clause, add newline
        this.linePrinter.appendNewline(level);
        this.linePrinter.appendText(text);
    }

    private handleCommentToken(token: SqlPrintToken): void {
        // Handle comments - only output if exportComment is true
        if (this.exportComment) {
            this.linePrinter.appendText(token.text);
            // Always add a space after comment to ensure SQL structure safety
            this.linePrinter.appendText(' ');
        }
    }

    private handleCteOnelineToken(token: SqlPrintToken, level: number): void {
        // Handle CTE with one-liner formatting when cteOneline is enabled
        const onelinePrinter = new SqlPrinter({
            indentChar: '',
            indentSize: 0,
            newline: ' ',
            commaBreak: this.commaBreak,
            andBreak: this.andBreak,
            keywordCase: this.keywordCase,
            exportComment: this.exportComment,
            strictCommentPlacement: this.strictCommentPlacement,
            cteOneline: false, // Prevent recursive CTE oneline processing
        });
        
        const onelineResult = onelinePrinter.print(token, level);
        this.linePrinter.appendText(onelineResult);
    }

    /**
     * Handle WITH clause with import comments
     * @param token The WITH clause token
     * @param level The indentation level
     */
    private handleWithClauseToken(token: SqlPrintToken, level: number): void {
        // Process the WITH clause normally first
        this.linePrinter.appendText(token.text);
        
        // Process inner tokens (CTEs)
        if (token.innerTokens && token.innerTokens.length > 0) {
            for (let i = 0; i < token.innerTokens.length; i++) {
                this.appendToken(token.innerTokens[i], level, token.containerType);
            }
        }
        
        // Add import comments after the WITH clause
        for (const comment of this.importComments) {
            this.linePrinter.appendNewline(level);
            this.linePrinter.appendText(`    ${comment}`);
        }
    }

    /**
     * Determines if a CTE should be formatted as oneline based on dependency rules
     * @param token The CTE token to evaluate
     * @returns true if the CTE should be formatted as oneline, false otherwise
     */
    private shouldFormatCteOneline(token: SqlPrintToken): boolean {
        // Original behavior - if cteOneline is enabled, format all CTEs as oneline
        if (this.cteOneline) {
            return true;
        }

        // New dependency-based behavior
        if (!this.cteOnelineDependency) {
            return false;
        }

        // Extract CTE name from token structure
        const cteName = this.extractCteNameFromToken(token);
        if (cteName && this.cteOnelineSet.has(cteName)) {
            return true;
        }
        
        return false;
    }

    /**
     * Extracts CTE name from a CommonTable token
     * @param token The CommonTable token
     * @returns The CTE name or null if not found
     */
    private extractCteNameFromToken(token: SqlPrintToken): string | null {
        // CommonTable token structure: [aliasExpression, SPACE, 'as', SPACE, ...]
        // We need to find the first token which should be the alias expression
        if (token.innerTokens && token.innerTokens.length > 0) {
            const aliasToken = token.innerTokens[0];
            if (aliasToken && aliasToken.text) {
                return aliasToken.text;
            }
        }
        return null;
    }
}