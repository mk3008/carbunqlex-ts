import { PartitionByClause, OrderByClause, OrderByItem, SelectClause, SelectItem, Distinct, DistinctOn, SortDirection, NullsSortDirection, TableSource, SourceExpression, FromClause, JoinClause, JoinOnClause, JoinUsingClause, FunctionSource, SourceAliasExpression, WhereClause, GroupByClause, HavingClause, SubQuerySource, WindowFrameClause, LimitClause, ForClause, OffsetClause, WindowsClause as WindowClause, CommonTable, WithClause, FetchClause, FetchExpression, InsertClause, UpdateClause, SetClause, ReturningClause, SetClauseItem } from "../models/Clause";
import { HintClause } from "../models/HintClause";
import { BinarySelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { SqlPrintToken, SqlPrintTokenType, SqlPrintTokenContainerType } from "../models/SqlPrintToken";
import {
    ValueList,
    ColumnReference,
    FunctionCall,
    UnaryExpression,
    BinaryExpression,
    LiteralValue,
    ParameterExpression,
    SwitchCaseArgument,
    CaseKeyValuePair,
    RawString,
    IdentifierString,
    ParenExpression,
    CastExpression,
    CaseExpression,
    ArrayExpression,
    ArrayQueryExpression,
    ArraySliceExpression,
    ArrayIndexExpression,
    BetweenExpression,
    StringSpecifierExpression,
    TypeValue,
    TupleExpression,
    WindowFrameExpression,
    QualifiedName,
    InlineQuery,
    WindowFrameSpec,
    WindowFrameBoundStatic,
    WindowFrameBoundaryValue
} from "../models/ValueComponent";
import { ParameterCollector } from "../transformers/ParameterCollector";
import { IdentifierDecorator } from "./IdentifierDecorator";
import { ParameterDecorator } from "./ParameterDecorator";
import { InsertQuery } from "../models/InsertQuery";
import { UpdateQuery } from "../models/UpdateQuery";
import { CreateTableQuery } from "../models/CreateTableQuery";

export enum ParameterStyle {
    Anonymous = 'anonymous',
    Indexed = 'indexed',
    Named = 'named'
}

export interface FormatterConfig {
    identifierEscape?: {
        start: string;
        end: string;
    };
    parameterSymbol?: string | { start: string; end: string };
    /**
     * Parameter style: anonymous (?), indexed ($1), or named (:name)
     */
    parameterStyle?: ParameterStyle;
}

export const PRESETS: Record<string, FormatterConfig> = {
    mysql: {
        identifierEscape: { start: '`', end: '`' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    postgres: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: '$',
        parameterStyle: ParameterStyle.Indexed,
    },
    postgresWithNamedParams: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: ':',
        parameterStyle: ParameterStyle.Named,
    },
    sqlserver: {
        identifierEscape: { start: '[', end: ']' },
        parameterSymbol: '@',
        parameterStyle: ParameterStyle.Named,
    },
    sqlite: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: ':',
        parameterStyle: ParameterStyle.Named,
    },
    oracle: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: ':',
        parameterStyle: ParameterStyle.Named,
    },
    clickhouse: {
        identifierEscape: { start: '`', end: '`' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    firebird: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    db2: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    snowflake: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    cloudspanner: {
        identifierEscape: { start: '`', end: '`' },
        parameterSymbol: '@',
        parameterStyle: ParameterStyle.Named,
    },
    duckdb: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    cockroachdb: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: '$',
        parameterStyle: ParameterStyle.Indexed,
    },
    athena: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    bigquery: {
        identifierEscape: { start: '`', end: '`' },
        parameterSymbol: '@',
        parameterStyle: ParameterStyle.Named,
    },
    hive: {
        identifierEscape: { start: '`', end: '`' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    mariadb: {
        identifierEscape: { start: '`', end: '`' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    redshift: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: '$',
        parameterStyle: ParameterStyle.Indexed,
    },
    flinksql: {
        identifierEscape: { start: '`', end: '`' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
    mongodb: {
        identifierEscape: { start: '"', end: '"' },
        parameterSymbol: '?',
        parameterStyle: ParameterStyle.Anonymous,
    },
};

export class SqlPrintTokenParser implements SqlComponentVisitor<SqlPrintToken> {
    // Static tokens for common symbols
    private static readonly SPACE_TOKEN = new SqlPrintToken(SqlPrintTokenType.space, ' ');
    private static readonly COMMA_TOKEN = new SqlPrintToken(SqlPrintTokenType.comma, ',');
    private static readonly ARGUMENT_SPLIT_COMMA_TOKEN = new SqlPrintToken(SqlPrintTokenType.argumentSplitter, ',');
    private static readonly PAREN_OPEN_TOKEN = new SqlPrintToken(SqlPrintTokenType.parenthesis, '(');
    private static readonly PAREN_CLOSE_TOKEN = new SqlPrintToken(SqlPrintTokenType.parenthesis, ')');
    private static readonly DOT_TOKEN = new SqlPrintToken(SqlPrintTokenType.dot, '.');

    private handlers: Map<symbol, (arg: any) => SqlPrintToken> = new Map();
    parameterDecorator: ParameterDecorator;
    identifierDecorator: IdentifierDecorator;
    index: number = 1;

    constructor(options?: {
        preset?: FormatterConfig,
        identifierEscape?: { start: string; end: string },
        parameterSymbol?: string | { start: string; end: string },
        parameterStyle?: 'anonymous' | 'indexed' | 'named'
    }) {
        if (options?.preset) {
            const preset = options.preset
            options = { ...preset, ...options };
        }

        this.parameterDecorator = new ParameterDecorator({
            prefix: typeof options?.parameterSymbol === 'string' ? options.parameterSymbol : options?.parameterSymbol?.start ?? ':',
            suffix: typeof options?.parameterSymbol === 'object' ? options.parameterSymbol.end : '',
            style: options?.parameterStyle ?? 'named'
        });

        this.identifierDecorator = new IdentifierDecorator({
            start: options?.identifierEscape?.start ?? '"',
            end: options?.identifierEscape?.end ?? '"'
        });

        this.handlers.set(ValueList.kind, (expr) => this.visitValueList(expr as ValueList));
        this.handlers.set(ColumnReference.kind, (expr) => this.visitColumnReference(expr as ColumnReference));
        this.handlers.set(QualifiedName.kind, (expr) => this.visitQualifiedName(expr as QualifiedName));
        this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
        this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        this.handlers.set(LiteralValue.kind, (expr) => this.visitLiteralValue(expr as LiteralValue));
        this.handlers.set(ParameterExpression.kind, (expr) => this.visitParameterExpression(expr as ParameterExpression));
        this.handlers.set(SwitchCaseArgument.kind, (expr) => this.visitSwitchCaseArgument(expr as SwitchCaseArgument));
        this.handlers.set(CaseKeyValuePair.kind, (expr) => this.visitCaseKeyValuePair(expr as CaseKeyValuePair));
        this.handlers.set(RawString.kind, (expr) => this.visitRawString(expr as RawString));
        this.handlers.set(IdentifierString.kind, (expr) => this.visitIdentifierString(expr as IdentifierString));
        this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
        this.handlers.set(ArrayQueryExpression.kind, (expr) => this.visitArrayQueryExpression(expr as ArrayQueryExpression));
        this.handlers.set(ArraySliceExpression.kind, (expr) => this.visitArraySliceExpression(expr as ArraySliceExpression));
        this.handlers.set(ArrayIndexExpression.kind, (expr) => this.visitArrayIndexExpression(expr as ArrayIndexExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        this.handlers.set(StringSpecifierExpression.kind, (expr) => this.visitStringSpecifierExpression(expr as StringSpecifierExpression));
        this.handlers.set(TypeValue.kind, (expr) => this.visitTypeValue(expr as TypeValue));
        this.handlers.set(TupleExpression.kind, (expr) => this.visitTupleExpression(expr as TupleExpression));
        this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));

        this.handlers.set(WindowFrameExpression.kind, (expr) => this.visitWindowFrameExpression(expr as WindowFrameExpression));
        this.handlers.set(WindowFrameSpec.kind, (expr) => this.visitWindowFrameSpec(expr as WindowFrameSpec));
        this.handlers.set(WindowFrameBoundStatic.kind, (expr) => this.visitWindowFrameBoundStatic(expr as WindowFrameBoundStatic));
        this.handlers.set(WindowFrameBoundaryValue.kind, (expr) => this.visitWindowFrameBoundaryValue(expr as WindowFrameBoundaryValue));
        this.handlers.set(PartitionByClause.kind, (expr) => this.visitPartitionByClause(expr as PartitionByClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr));

        // select
        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(Distinct.kind, (expr) => this.visitDistinct(expr as Distinct));
        this.handlers.set(DistinctOn.kind, (expr) => this.visitDistinctOn(expr as DistinctOn));
        this.handlers.set(HintClause.kind, (expr) => this.visitHintClause(expr as HintClause));

        // from
        this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));
        this.handlers.set(FunctionSource.kind, (expr) => this.visitFunctionSource(expr as FunctionSource));
        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        this.handlers.set(SourceAliasExpression.kind, (expr) => this.visitSourceAliasExpression(expr as SourceAliasExpression));
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(JoinClause.kind, (expr) => this.visitJoinClause(expr as JoinClause));
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        // where
        this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));

        // group
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));

        this.handlers.set(WindowClause.kind, (expr) => this.visitWindowClause(expr as WindowClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(OffsetClause.kind, (expr) => this.visitOffsetClause(expr as OffsetClause));
        this.handlers.set(FetchClause.kind, (expr) => this.visitFetchClause(expr as FetchClause));
        this.handlers.set(FetchExpression.kind, (expr) => this.visitFetchExpression(expr as FetchExpression));
        this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));

        // With
        this.handlers.set(WithClause.kind, (expr) => this.visitWithClause(expr as WithClause));
        this.handlers.set(CommonTable.kind, (expr) => this.visitCommonTable(expr as CommonTable));

        // Query
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleQuery(expr as SimpleSelectQuery));
        this.handlers.set(SubQuerySource.kind, (expr) => this.visitSubQuerySource(expr as SubQuerySource));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr));
        this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));
        this.handlers.set(TupleExpression.kind, (expr) => this.visitTupleExpression(expr as TupleExpression));

        this.handlers.set(InsertQuery.kind, (expr) => this.visitInsertQuery(expr as InsertQuery));
        this.handlers.set(InsertClause.kind, (expr) => this.visitInsertClause(expr as InsertClause));
        this.handlers.set(UpdateQuery.kind, (expr) => this.visitUpdateQuery(expr as UpdateQuery));
        this.handlers.set(UpdateClause.kind, (expr) => this.visitUpdateClause(expr as UpdateClause));
        this.handlers.set(SetClause.kind, (expr) => this.visitSetClause(expr as SetClause));
        this.handlers.set(SetClauseItem.kind, (expr) => this.visitSetClauseItem(expr as SetClauseItem));
        this.handlers.set(ReturningClause.kind, (expr) => this.visitReturningClause(expr as ReturningClause));
        this.handlers.set(CreateTableQuery.kind, (expr) => this.visitCreateTableQuery(expr as CreateTableQuery));
    }

    /**
     * Pretty-prints a BinarySelectQuery (e.g., UNION, INTERSECT, EXCEPT).
     * This will recursively print left and right queries, separated by the operator.
     * @param arg BinarySelectQuery
     */
    private visitBinarySelectQuery(arg: BinarySelectQuery): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.innerTokens.push(this.visit(arg.left));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, arg.operator.value, SqlPrintTokenContainerType.BinarySelectQueryOperator));

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.right));

        return token;
    }

    /**
     * Returns an array of tokens representing a comma followed by a space.
     * This is a common pattern in SQL pretty-printing.
     */
    private static commaSpaceTokens(): SqlPrintToken[] {
        return [SqlPrintTokenParser.COMMA_TOKEN, SqlPrintTokenParser.SPACE_TOKEN];
    }

    private static argumentCommaSpaceTokens(): SqlPrintToken[] {
        return [SqlPrintTokenParser.ARGUMENT_SPLIT_COMMA_TOKEN, SqlPrintTokenParser.SPACE_TOKEN];
    }


    private visitQualifiedName(arg: QualifiedName): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.QualifiedName);

        if (arg.namespaces) {
            for (let i = 0; i < arg.namespaces.length; i++) {
                token.innerTokens.push(arg.namespaces[i].accept(this));
                token.innerTokens.push(SqlPrintTokenParser.DOT_TOKEN);
            }
        }
        token.innerTokens.push(arg.name.accept(this));

        return token;
    }

    private visitPartitionByClause(arg: PartitionByClause): SqlPrintToken {
        // Print as: partition by ...
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'partition by', SqlPrintTokenContainerType.PartitionByClause);
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.value));
        return token;
    }

    private visitOrderByClause(arg: OrderByClause): SqlPrintToken {
        // Print as: order by ...
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'order by', SqlPrintTokenContainerType.OrderByClause);
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        for (let i = 0; i < arg.order.length; i++) {
            if (i > 0) token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            token.innerTokens.push(this.visit(arg.order[i]));
        }
        return token;
    }

    /**
     * Print an OrderByItem (expression [asc|desc] [nulls first|last])
     */
    private visitOrderByItem(arg: OrderByItem): SqlPrintToken {
        // arg: OrderByItem
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.OrderByItem);
        token.innerTokens.push(this.visit(arg.value));

        if (arg.sortDirection && arg.sortDirection !== SortDirection.Ascending) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'desc'));
        }

        if (arg.nullsPosition) {
            if (arg.nullsPosition === NullsSortDirection.First) {
                token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'nulls first'));
            } else if (arg.nullsPosition === NullsSortDirection.Last) {
                token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'nulls last'));
            }
        }
        return token;
    }

    public parse(arg: SqlComponent): { token: SqlPrintToken, params: any[] | Record<string, any>[] | Record<string, any> } {
        // reset parameter index before parsing
        this.index = 1;

        const token = this.visit(arg);
        const paramsRaw = ParameterCollector.collect(arg).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

        const style = this.parameterDecorator.style;
        if (style === ParameterStyle.Named) {
            // Named: { name: value, ... }
            const paramsObj: Record<string, any> = {};
            for (const p of paramsRaw) {
                const key = p.name.value;
                if (paramsObj.hasOwnProperty(key)) {
                    if (paramsObj[key] !== p.value) {
                        throw new Error(`Duplicate parameter name '${key}' with different values detected during query composition.`);
                    }
                    // If value is the same, skip (already set)
                    continue;
                }
                paramsObj[key] = p.value;
            }
            return { token, params: paramsObj };
        } else if (style === ParameterStyle.Indexed) {
            // Indexed: [value1, value2, ...] (sorted by index)
            const paramsArr = paramsRaw.map(p => p.value);
            return { token, params: paramsArr };
        } else if (style === ParameterStyle.Anonymous) {
            // Anonymous: [value1, value2, ...] (sorted by index, name is empty)
            const paramsArr = paramsRaw.map(p => p.value);
            return { token, params: paramsArr };
        }

        // Fallback (just in case)
        return { token, params: [] };
    }

    public visit(arg: SqlComponent): SqlPrintToken {
        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            const token = handler(arg);
            // Add comments to the token if they exist
            this.addCommentsToToken(token, arg.comments);
            return token;
        }
        throw new Error(`[SqlPrintTokenParser] No handler for kind: ${arg.getKind().toString()}`);
    }

    /**
     * Adds comment tokens to a SqlPrintToken based on the comments array
     */
    private addCommentsToToken(token: SqlPrintToken, comments: string[] | null): void {
        if (!comments || comments.length === 0) {
            return;
        }

        // Create CommentBlock containers for each comment
        const commentBlocks = this.createCommentBlocks(comments);

        // Insert comment blocks and handle spacing
        if (commentBlocks.length > 0) {
            this.insertCommentBlocksWithSpacing(token, commentBlocks);
        }
    }

    /**
     * Creates CommentBlock containers for the given comments.
     * Each CommentBlock contains: Comment -> CommentNewline -> Space
     * This structure supports both oneliner and multiline formatting modes.
     */
    private createCommentBlocks(comments: string[]): SqlPrintToken[] {
        const commentBlocks: SqlPrintToken[] = [];
        
        for (const comment of comments) {
            if (comment.trim()) {
                commentBlocks.push(this.createSingleCommentBlock(comment));
            }
        }
        
        return commentBlocks;
    }

    /**
     * Creates a single CommentBlock with the standard structure:
     * Comment -> CommentNewline -> Space
     * 
     * This structure supports both formatting modes:
     * - Multiline mode: Comment + newline (space is filtered as leading space)
     * - Oneliner mode: Comment + space (commentNewline is skipped)
     */
    private createSingleCommentBlock(comment: string): SqlPrintToken {
        const commentBlock = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CommentBlock);
        
        // Add comment token
        const commentToken = new SqlPrintToken(SqlPrintTokenType.comment, this.formatBlockComment(comment));
        commentBlock.innerTokens.push(commentToken);
        
        // Add conditional newline token for multiline mode
        const commentNewlineToken = new SqlPrintToken(SqlPrintTokenType.commentNewline, '');
        commentBlock.innerTokens.push(commentNewlineToken);
        
        // Add space token for oneliner mode spacing
        const spaceToken = new SqlPrintToken(SqlPrintTokenType.space, ' ');
        commentBlock.innerTokens.push(spaceToken);
        
        return commentBlock;
    }

    /**
     * Inserts comment blocks into a token and handles spacing logic.
     * Adds separator spaces for clause-level containers and manages duplicate space removal.
     */
    private insertCommentBlocksWithSpacing(token: SqlPrintToken, commentBlocks: SqlPrintToken[]): void {
        token.innerTokens.unshift(...commentBlocks);
        
        // Add a separator space after comments only for certain container types
        // where comments need to be separated from main content
        const needsSeparatorSpace = this.shouldAddSeparatorSpace(token.containerType);
        
        if (needsSeparatorSpace) {
            const separatorSpace = new SqlPrintToken(SqlPrintTokenType.space, ' ');
            token.innerTokens.splice(commentBlocks.length, 0, separatorSpace);
            
            // Remove the original space token after our separator if it exists 
            // This prevents duplicate spaces when comments are added
            if (token.innerTokens.length > commentBlocks.length + 1 && 
                token.innerTokens[commentBlocks.length + 1].type === SqlPrintTokenType.space) {
                token.innerTokens.splice(commentBlocks.length + 1, 1);
            }
        } else {
            // For containers that don't need separator space, still remove duplicate spaces
            if (token.innerTokens.length > commentBlocks.length && 
                token.innerTokens[commentBlocks.length].type === SqlPrintTokenType.space) {
                token.innerTokens.splice(commentBlocks.length, 1);
            }
        }
    }

    /**
     * Determines whether a separator space should be added after comments for the given container type.
     * 
     * Clause-level containers (SELECT, FROM, WHERE, etc.) need separator spaces because:
     * - Comments appear before the main clause content
     * - A space is needed to separate comment block from SQL tokens
     * 
     * Item-level containers (SelectItem, etc.) don't need separator spaces because:
     * - Comments are inline with the item content
     * - Spacing is handled by existing token structure
     */
    private shouldAddSeparatorSpace(containerType: SqlPrintTokenContainerType): boolean {
        return this.isClauseLevelContainer(containerType);
    }

    /**
     * Checks if the container type represents a SQL clause (as opposed to an item within a clause).
     */
    private isClauseLevelContainer(containerType: SqlPrintTokenContainerType): boolean {
        switch (containerType) {
            case SqlPrintTokenContainerType.SelectClause:
            case SqlPrintTokenContainerType.FromClause:
            case SqlPrintTokenContainerType.WhereClause:
            case SqlPrintTokenContainerType.GroupByClause:
            case SqlPrintTokenContainerType.HavingClause:
            case SqlPrintTokenContainerType.OrderByClause:
            case SqlPrintTokenContainerType.LimitClause:
            case SqlPrintTokenContainerType.OffsetClause:
            case SqlPrintTokenContainerType.WithClause:
            case SqlPrintTokenContainerType.SimpleSelectQuery:
                return true;
            default:
                return false;
        }
    }

    /**
     * Formats a comment string as a block comment.
     */
    private formatBlockComment(comment: string): string {
        return `/* ${comment} */`;
    }

    private visitValueList(arg: ValueList): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ValueList);
        for (let i = 0; i < arg.values.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.argumentCommaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.values[i]));
        }
        return token;
    }

    private visitColumnReference(arg: ColumnReference): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ColumnReference);
        token.innerTokens.push(arg.qualifiedName.accept(this));
        return token;
    }

    private visitFunctionCall(arg: FunctionCall): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.FunctionCall);

        token.innerTokens.push(arg.qualifiedName.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        if (arg.argument) {
            token.innerTokens.push(this.visit(arg.argument));
        }
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        if (arg.over) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'over'));

            if (arg.over instanceof IdentifierString) {
                token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                token.innerTokens.push(arg.over.accept(this));
            }
            else {
                token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
                token.innerTokens.push(this.visit(arg.over));
                token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
            }
        }

        return token;
    }

    private visitUnaryExpression(arg: UnaryExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.UnaryExpression);

        token.innerTokens.push(this.visit(arg.operator));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.expression));

        return token;
    }

    private visitBinaryExpression(arg: BinaryExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.BinaryExpression);

        token.innerTokens.push(this.visit(arg.left));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.operator, arg.operator.value));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.right));

        return token;
    }

    private visitLiteralValue(arg: LiteralValue): SqlPrintToken {
        let text;
        if (typeof arg.value === "string") {
            if (arg.isDollarString) {
                // For dollar-quoted strings, return the original format
                text = arg.value;
            } else {
                text = `'${arg.value.replace(/'/g, "''")}'`;
            }
        } else if (arg.value === null) {
            text = "null";
        } else {
            text = arg.value.toString();
        }
        return new SqlPrintToken(
            SqlPrintTokenType.value,
            text,
            SqlPrintTokenContainerType.LiteralValue
        );
    }

    private visitParameterExpression(arg: ParameterExpression): SqlPrintToken {
        // Create a parameter token and decorate it using the parameterDecorator
        arg.index = this.index;
        const text = this.parameterDecorator.decorate(arg.name.value, arg.index)
        const token = new SqlPrintToken(SqlPrintTokenType.parameter, text);

        this.index++;
        return token;
    }

    private visitSwitchCaseArgument(arg: SwitchCaseArgument): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SwitchCaseArgument);

        // Add each WHEN/THEN clause
        for (const kv of arg.cases) {
            // Create a new line for each WHEN clause
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(kv.accept(this));
        }

        // Add ELSE clause if present
        if (arg.elseValue) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(this.createElseToken(arg.elseValue));
        }
        return token;
    }

    private createElseToken(elseValue: SqlComponent): SqlPrintToken {
        // Creates a token for the ELSE clause in a CASE expression.
        const elseToken = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ElseClause);        // Add the ELSE keyword
        elseToken.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'else'));

        // Create a container for the ELSE value to enable proper indentation
        elseToken.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        const elseValueContainer = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CaseElseValue);
        elseValueContainer.innerTokens.push(this.visit(elseValue));
        elseToken.innerTokens.push(elseValueContainer);

        return elseToken;
    }

    private visitCaseKeyValuePair(arg: CaseKeyValuePair): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CaseKeyValuePair);

        // Create WHEN clause
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'when'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.key));        // Create THEN clause
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'then'));

        // Create a container for the THEN value to enable proper indentation
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        const thenValueContainer = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CaseThenValue);
        thenValueContainer.innerTokens.push(this.visit(arg.value));
        token.innerTokens.push(thenValueContainer);

        return token;
    }

    private visitRawString(arg: RawString): SqlPrintToken {
        // Even for non-container tokens, set the container type for context
        return new SqlPrintToken(
            SqlPrintTokenType.value,
            arg.value,
            SqlPrintTokenContainerType.RawString
        );
    }

    private visitIdentifierString(arg: IdentifierString): SqlPrintToken {
        // Create an identifier token and decorate it using the identifierDecorator
        const text = arg.name === "*" ? arg.name : this.identifierDecorator.decorate(arg.name)
        const token = new SqlPrintToken(
            SqlPrintTokenType.value,
            text,
            SqlPrintTokenContainerType.IdentifierString
        );
        return token;
    }

    private visitParenExpression(arg: ParenExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ParenExpression);

        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.innerTokens.push(this.visit(arg.expression));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitCastExpression(arg: CastExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CastExpression);

        token.innerTokens.push(this.visit(arg.input));
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.operator, '::'));
        token.innerTokens.push(this.visit(arg.castType));

        return token;
    }

    private visitCaseExpression(arg: CaseExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CaseExpression);

        // Add the CASE keyword
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'case'));

        // Add the condition if exists
        if (arg.condition) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(this.visit(arg.condition));
        }

        // Add the WHEN/THEN pairs and ELSE
        token.innerTokens.push(this.visit(arg.switchCase));

        // Add the END keyword
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'end'));

        return token;
    }

    private visitArrayExpression(arg: ArrayExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ArrayExpression);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'array'));
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, '['));
        token.innerTokens.push(this.visit(arg.expression));
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, ']'));

        return token;
    }

    private visitArrayQueryExpression(arg: ArrayQueryExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ArrayExpression);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'array'));
        // ARRAY(SELECT ...)
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, '('));
        token.innerTokens.push(this.visit(arg.query));
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, ')'));

        return token;
    }

    private visitArraySliceExpression(arg: ArraySliceExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ArrayExpression);

        // array expression
        token.innerTokens.push(this.visit(arg.array));
        
        // opening bracket
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, '['));
        
        // start index (optional)
        if (arg.startIndex) {
            token.innerTokens.push(this.visit(arg.startIndex));
        }
        
        // colon separator
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.operator, ':'));
        
        // end index (optional)
        if (arg.endIndex) {
            token.innerTokens.push(this.visit(arg.endIndex));
        }
        
        // closing bracket
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, ']'));

        return token;
    }

    private visitArrayIndexExpression(arg: ArrayIndexExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ArrayExpression);

        // array expression
        token.innerTokens.push(this.visit(arg.array));
        
        // opening bracket
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, '['));
        
        // index
        token.innerTokens.push(this.visit(arg.index));
        
        // closing bracket
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.parenthesis, ']'));

        return token;
    }

    private visitBetweenExpression(arg: BetweenExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.BetweenExpression);

        token.innerTokens.push(this.visit(arg.expression));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        if (arg.negated) {
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'not'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        }
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'between'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.lower));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'and'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.upper));

        return token;
    }

    private visitStringSpecifierExpression(arg: StringSpecifierExpression): SqlPrintToken {
        // Combine specifier and value into a single token
        const specifier = arg.specifier.accept(this).text;
        const value = arg.value.accept(this).text;
        return new SqlPrintToken(
            SqlPrintTokenType.value,
            specifier + value,
            SqlPrintTokenContainerType.StringSpecifierExpression
        );
    }

    private visitTypeValue(arg: TypeValue): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.TypeValue);

        token.innerTokens.push(arg.qualifiedName.accept(this));
        if (arg.argument) {
            token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
            token.innerTokens.push(this.visit(arg.argument));
            token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        }

        return token;
    }

    private visitTupleExpression(arg: TupleExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.TupleExpression);

        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        for (let i = 0; i < arg.values.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.argumentCommaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.values[i]));
        }
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitWindowFrameExpression(arg: WindowFrameExpression): SqlPrintToken {
        // Compose window frame expression: over(partition by ... order by ... rows ...)
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.WindowFrameExpression);

        let first = true;
        if (arg.partition) {
            token.innerTokens.push(this.visit(arg.partition));
            first = false;
        }
        if (arg.order) {
            if (!first) {
                token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            } else {
                first = false;
            }
            token.innerTokens.push(this.visit(arg.order));
        }
        if (arg.frameSpec) {
            if (!first) {
                token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            } else {
                first = false;
            }
            token.innerTokens.push(this.visit(arg.frameSpec));
        }

        return token;
    }

    private visitWindowFrameSpec(arg: WindowFrameSpec): SqlPrintToken {
        // This method prints a window frame specification, such as "rows between ... and ..." or "range ...".
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.WindowFrameSpec);

        // Add frame type (e.g., "rows", "range", "groups")
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, arg.frameType));

        if (arg.endBound === null) {
            // Only start bound: e.g., "rows unbounded preceding"
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.startBound.accept(this));
        } else {
            // Between: e.g., "rows between unbounded preceding and current row"
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'between'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.startBound.accept(this));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'and'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.endBound.accept(this));
        }

        return token;
    }

    /**
     * Prints a window frame boundary value, such as "5 preceding" or "3 following".
     * @param arg WindowFrameBoundaryValue
     */
    private visitWindowFrameBoundaryValue(arg: WindowFrameBoundaryValue): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.WindowFrameBoundaryValue);

        token.innerTokens.push(arg.value.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        //  true for "FOLLOWING", false for "PRECEDING"
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, arg.isFollowing ? 'following' : 'preceding'));

        return token;
    }

    /**
     * Prints a static window frame bound, such as "unbounded preceding", "current row", or "unbounded following".
     * @param arg WindowFrameBoundStatic
     */
    private visitWindowFrameBoundStatic(arg: WindowFrameBoundStatic): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, arg.bound);
        return token;
    }

    private visitSelectItem(arg: SelectItem): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SelectItem);

        token.innerTokens.push(this.visit(arg.value));

        if (!arg.identifier) {
            return token;
        }

        // No alias needed if it matches the default name
        if (arg.value instanceof ColumnReference) {
            const defaultName = arg.value.column.name;
            if (arg.identifier.name === defaultName) {
                return token;
            }
        }

        // Add alias if it is different from the default name
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.identifier));
        return token;
    }

    private visitSelectClause(arg: SelectClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'select', SqlPrintTokenContainerType.SelectClause);

        // Handle hints and DISTINCT as part of the keyword line
        let selectKeywordText = 'select';
        
        // Add hint clauses immediately after SELECT (before DISTINCT)
        for (const hint of arg.hints) {
            selectKeywordText += ' ' + this.visit(hint).text;
        }

        // Add DISTINCT after hints (if present)  
        if (arg.distinct) {
            const distinctToken = arg.distinct.accept(this);
            if (distinctToken.innerTokens && distinctToken.innerTokens.length > 0) {
                // For compound DISTINCT tokens (like DISTINCT ON), concatenate all parts
                let distinctText = distinctToken.text;
                for (const innerToken of distinctToken.innerTokens) {
                    distinctText += this.flattenTokenText(innerToken);
                }
                selectKeywordText += ' ' + distinctText;
            } else {
                selectKeywordText += ' ' + distinctToken.text;
            }
        }

        // Update the token text to include hints and DISTINCT
        token.text = selectKeywordText;
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);

        for (let i = 0; i < arg.items.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.items[i]));
        }

        return token;
    }

    private flattenTokenText(token: SqlPrintToken): string {
        let result = token.text;
        if (token.innerTokens) {
            for (const innerToken of token.innerTokens) {
                result += this.flattenTokenText(innerToken);
            }
        }
        return result;
    }

    private visitHintClause(arg: HintClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.value, arg.getFullHint());
        return token;
    }

    private visitDistinct(arg: Distinct): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'distinct');
        return token;
    }

    private visitDistinctOn(arg: DistinctOn): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.DistinctOn);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'distinct on'));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.innerTokens.push(arg.value.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitTableSource(arg: TableSource): SqlPrintToken {
        // Print table name with optional namespaces and alias
        let fullName = '';
        if (Array.isArray(arg.namespaces) && arg.namespaces.length > 0) {
            fullName = arg.namespaces.map(ns => ns.accept(this).text).join('.') + '.';
        }
        fullName += arg.table.accept(this).text;
        const token = new SqlPrintToken(SqlPrintTokenType.value, fullName);
        // alias (if present and different from table name)
        if (arg.identifier && arg.identifier.name !== arg.table.name) {

        }
        return token;
    }

    private visitSourceExpression(arg: SourceExpression): SqlPrintToken {
        // Print source expression (e.g. "table", "table as t", "schema.table t")
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SourceExpression);
        token.innerTokens.push(arg.datasource.accept(this));

        if (!arg.aliasExpression) {
            return token;
        }

        if (arg.datasource instanceof TableSource) {
            // No alias needed if it matches the default name
            const defaultName = arg.datasource.table.name;
            if (arg.aliasExpression.table.name === defaultName) {
                return token;
            }
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            // exclude column aliases
            token.innerTokens.push(arg.aliasExpression.accept(this));
            return token;
        } else {
            // For other source types, just print the alias
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            // included column aliases
            token.innerTokens.push(arg.aliasExpression.accept(this));
            return token;
        }
    }

    public visitFromClause(arg: FromClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'from', SqlPrintTokenContainerType.FromClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.source));

        if (arg.joins) {
            for (let i = 0; i < arg.joins.length; i++) {
                token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
                token.innerTokens.push(this.visit(arg.joins[i]));
            }
        }

        return token;
    }

    public visitJoinClause(arg: JoinClause): SqlPrintToken {
        // Print join clause: [joinType] [lateral] [source] [on/using ...]
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.JoinClause);

        // join type (e.g. inner join, left join, etc)
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, arg.joinType.value));
        if (arg.lateral) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'lateral'));
        }
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.source));

        if (arg.condition) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(this.visit(arg.condition));
        }

        return token;
    }

    public visitJoinOnClause(arg: JoinOnClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.JoinOnClause);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'on'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.condition));

        return token;
    }

    public visitJoinUsingClause(arg: JoinUsingClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.JoinUsingClause);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'using'));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.innerTokens.push(this.visit(arg.condition));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    public visitFunctionSource(arg: FunctionSource): SqlPrintToken {
        // Print function source: [functionName]([args])
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.FunctionSource);

        token.innerTokens.push(arg.qualifiedName.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        if (arg.argument) {
            token.innerTokens.push(this.visit(arg.argument));
        }
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        return token;
    }

    public visitSourceAliasExpression(arg: SourceAliasExpression): SqlPrintToken {
        // Print source alias expression: [source] as [alias]
        const token = new SqlPrintToken(
            SqlPrintTokenType.container,
            '',
            SqlPrintTokenContainerType.SourceAliasExpression
        );

        token.innerTokens.push(this.visit(arg.table));

        if (arg.columns) {
            token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
            for (let i = 0; i < arg.columns.length; i++) {
                if (i > 0) {
                    token.innerTokens.push(...SqlPrintTokenParser.argumentCommaSpaceTokens());
                }
                token.innerTokens.push(this.visit(arg.columns[i]));
            }
            token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        }

        return token;
    }

    public visitWhereClause(arg: WhereClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'where', SqlPrintTokenContainerType.WhereClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.condition));

        return token;
    }

    public visitGroupByClause(arg: GroupByClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'group by', SqlPrintTokenContainerType.GroupByClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        for (let i = 0; i < arg.grouping.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.grouping[i]));
        }

        return token;
    }

    public visitHavingClause(arg: HavingClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'having', SqlPrintTokenContainerType.HavingClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.condition));

        return token;
    }

    public visitWindowClause(arg: WindowClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'window', SqlPrintTokenContainerType.WindowClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        for (let i = 0; i < arg.windows.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.windows[i]));
        }

        return token;
    }

    public visitWindowFrameClause(arg: WindowFrameClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.WindowFrameClause);

        token.innerTokens.push(arg.name.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
        token.innerTokens.push(this.visit(arg.expression));
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    public visitLimitClause(arg: LimitClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'limit', SqlPrintTokenContainerType.LimitClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.value));

        return token;
    }

    public visitOffsetClause(arg: OffsetClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'offset', SqlPrintTokenContainerType.OffsetClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.value));

        return token;
    }

    public visitFetchClause(arg: FetchClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'fetch', SqlPrintTokenContainerType.FetchClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(this.visit(arg.expression));

        return token;
    }

    public visitFetchExpression(arg: FetchExpression): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.FetchExpression);

        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, arg.type));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(arg.count.accept(this));

        if (arg.unit) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, arg.unit));
        }

        return token;
    }

    public visitForClause(arg: ForClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'for', SqlPrintTokenContainerType.ForClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, arg.lockMode));

        return token;
    }

    public visitWithClause(arg: WithClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'with', SqlPrintTokenContainerType.WithClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        if (arg.recursive) {
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'recursive'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        }

        for (let i = 0; i < arg.tables.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(arg.tables[i].accept(this));
        }

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        return token;
    }

    public visitCommonTable(arg: CommonTable): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CommonTable);

        token.innerTokens.push(arg.aliasExpression.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);

        if (arg.materialized !== null) {
            if (arg.materialized) {
                token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'materialized'));
            } else {
                token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'not materialized'));
            }
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        }

        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);

        const query = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SubQuerySource);
        query.innerTokens.push(arg.query.accept(this));

        token.innerTokens.push(query);
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    // query
    public visitSimpleQuery(arg: SimpleSelectQuery): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SimpleSelectQuery);

        if (arg.withClause) {
            token.innerTokens.push(arg.withClause.accept(this));
        }

        token.innerTokens.push(arg.selectClause.accept(this));

        if (!arg.fromClause) {
            return token;
        }

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(arg.fromClause.accept(this));

        if (arg.whereClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.whereClause.accept(this));
        }

        if (arg.groupByClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.groupByClause.accept(this));
        }

        if (arg.havingClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.havingClause.accept(this));
        }

        if (arg.orderByClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.orderByClause.accept(this));
        }

        if (arg.windowClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.windowClause.accept(this));
        }

        if (arg.limitClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.limitClause.accept(this));
        }

        if (arg.offsetClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.offsetClause.accept(this));
        }

        if (arg.fetchClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.fetchClause.accept(this));
        }

        if (arg.forClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.forClause.accept(this));
        }

        return token;
    }

    public visitSubQuerySource(arg: SubQuerySource): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);

        const subQuery = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SubQuerySource);
        subQuery.innerTokens.push(arg.query.accept(this));

        token.innerTokens.push(subQuery);
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    public visitValuesQuery(arg: ValuesQuery): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'values', SqlPrintTokenContainerType.ValuesQuery);
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);

        const values = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.Values);
        for (let i = 0; i < arg.tuples.length; i++) {
            if (i > 0) {
                values.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            values.innerTokens.push(arg.tuples[i].accept(this));
        }

        token.innerTokens.push(values);
        return token;
    }

    public visitInlineQuery(arg: InlineQuery): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);

        const queryToken = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.InlineQuery);
        queryToken.innerTokens.push(arg.selectQuery.accept(this));

        token.innerTokens.push(queryToken);
        token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);

        return token;
    }

    private visitInsertQuery(arg: InsertQuery): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.InsertQuery);

        // Process the insert clause
        token.innerTokens.push(this.visit(arg.insertClause));

        // Process the select query if present
        if (arg.selectQuery) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(this.visit(arg.selectQuery));
        }

        return token;
    }

    private visitInsertClause(arg: InsertClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '');

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'insert into'));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(arg.source.accept(this));

        if (arg.columns.length > 0) {
            token.innerTokens.push(SqlPrintTokenParser.PAREN_OPEN_TOKEN);
            for (let i = 0; i < arg.columns.length; i++) {
                if (i > 0) {
                    token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
                }
                token.innerTokens.push(arg.columns[i].accept(this));
            }
            token.innerTokens.push(SqlPrintTokenParser.PAREN_CLOSE_TOKEN);
        }

        return token;
    }

    private visitUpdateQuery(arg: UpdateQuery): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.UpdateQuery);

        if (arg.withClause) {
            token.innerTokens.push(arg.withClause.accept(this));
        }

        token.innerTokens.push(arg.updateClause.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(arg.setClause.accept(this));

        if (arg.fromClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.fromClause.accept(this));
        }

        if (arg.whereClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.whereClause.accept(this));
        }

        if (arg.returningClause) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.returningClause.accept(this));
        }

        return token;
    }

    public visitUpdateClause(arg: UpdateClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'update', SqlPrintTokenContainerType.UpdateClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(arg.source.accept(this));

        return token;
    }

    public visitSetClause(arg: SetClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'set', SqlPrintTokenContainerType.SelectClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        for (let i = 0; i < arg.items.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.items[i]));
        }

        return token;
    }

    public visitSetClauseItem(arg: SetClauseItem): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.SetClauseItem);

        token.innerTokens.push(arg.column.accept(this));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.operator, '='));
        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(arg.value.accept(this));

        return token;
    }

    public visitReturningClause(arg: ReturningClause): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, 'returning', SqlPrintTokenContainerType.ReturningClause);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        for (let i = 0; i < arg.columns.length; i++) {
            if (i > 0) {
                token.innerTokens.push(...SqlPrintTokenParser.commaSpaceTokens());
            }
            token.innerTokens.push(this.visit(arg.columns[i]));
        }

        return token;
    }

    public visitCreateTableQuery(arg: CreateTableQuery): SqlPrintToken {
        const token = new SqlPrintToken(SqlPrintTokenType.keyword, arg.isTemporary ? 'create temporary table' : 'create table', SqlPrintTokenContainerType.CreateTableQuery);

        token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
        token.innerTokens.push(arg.tableName.accept(this));

        if (arg.asSelectQuery) {
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'as'));
            token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
            token.innerTokens.push(arg.asSelectQuery.accept(this));
        }

        return token;
    }
}
