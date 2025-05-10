import { CommonTable, FetchClause, ForClause, FromClause, GroupByClause, HavingClause, JoinClause, JoinOnClause, JoinUsingClause, LimitClause, OffsetClause, OrderByClause, OrderByItem, ParenSource, PartitionByClause, SelectClause, SelectItem, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WindowsClause, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import {
    ArrayExpression, BetweenExpression, BinaryExpression, CaseExpression, CaseKeyValuePair,
    CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression,
    ParameterExpression, SwitchCaseArgument, TupleExpression, UnaryExpression, ValueComponent,
    OverExpression, WindowFrameExpression, IdentifierString, RawString,
    WindowFrameSpec,
    LiteralValue,
    TypeValue
} from "../models/ValueComponent";
import { CTECollector } from "./CTECollector";

/**
 * A visitor that collects all table source names from a SQL query structure.
 * 
 * When selectableOnly is true (default behavior):
 * - Includes only table sources from FROM and JOIN clauses
 * - Excludes inline queries, subqueries, and CTEs
 * 
 * When selectableOnly is false:
 * - Scans all parts of the query including WITH clauses, subqueries, etc.
 * - Collects all table sources from the entire query
 * - Excludes tables that are managed by CTEs
 * 
 * For UNION-like queries, it scans both the left and right parts.
 */
export class TableSourceCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private tableSources: TableSource[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();
    private tableNameMap: Map<string, boolean> = new Map<string, boolean>();
    private selectableOnly: boolean;
    private cteNames: Set<string> = new Set<string>();
    private isRootVisit: boolean = true;

    constructor(selectableOnly: boolean = true) {
        this.selectableOnly = selectableOnly;
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Setup handlers for query components
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
        this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));

        // WITH clause and common tables
        this.handlers.set(WithClause.kind, (expr) => this.visitWithClause(expr as WithClause));
        this.handlers.set(CommonTable.kind, (expr) => this.visitCommonTable(expr as CommonTable));

        // Handlers for FROM and JOIN components
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(JoinClause.kind, (expr) => this.visitJoinClause(expr as JoinClause));
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        // Source components
        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));
        this.handlers.set(ParenSource.kind, (expr) => this.visitParenSource(expr as ParenSource));
        this.handlers.set(SubQuerySource.kind, (expr) => this.visitSubQuerySource(expr as SubQuerySource));
        this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));

        // Only register these handlers when not in selectableOnly mode
        if (!selectableOnly) {
            // Additional clause handlers for full scanning
            this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));
            this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
            this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
            this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
            this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
            this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
            this.handlers.set(OffsetClause.kind, (expr) => this.visitOffsetClause(expr as OffsetClause));
            this.handlers.set(FetchClause.kind, (expr) => this.visitFetchClause(expr as FetchClause));
            this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));
            this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr as OrderByItem));
            this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
            this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));

            // Value components that might contain table references
            this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
            this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
            this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
            this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
            this.handlers.set(CaseKeyValuePair.kind, (expr) => this.visitCaseKeyValuePair(expr as CaseKeyValuePair));
            this.handlers.set(SwitchCaseArgument.kind, (expr) => this.visitSwitchCaseArgument(expr as SwitchCaseArgument));
            this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
            this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
            this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
            this.handlers.set(TupleExpression.kind, (expr) => this.visitTupleExpression(expr as TupleExpression));
            this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        }
    }

    /**
     * Gets all collected table sources
     */
    public getTableSources(): TableSource[] {
        return this.tableSources;
    }

    /**
     * Reset the collection of table sources
     */
    private reset(): void {
        this.tableSources = [];
        this.tableNameMap.clear();
        this.visitedNodes.clear();
        this.cteNames.clear();
    }

    /**
     * Gets a unique identifier for a table source
     */
    private getTableIdentifier(source: TableSource): string {
        // Use QualifiedName for identifier (dot-joined string)
        if (source.qualifiedName.namespaces && source.qualifiedName.namespaces.length > 0) {
            return source.qualifiedName.namespaces.map(ns => ns.name).join('.') + '.' + (source.qualifiedName.name instanceof RawString ? source.qualifiedName.name.value : source.qualifiedName.name.name);
        } else {
            return source.qualifiedName.name instanceof RawString ? source.qualifiedName.name.value : source.qualifiedName.name.name;
        }
    }

    public collect(query: SqlComponent): TableSource[] {
        // Visit the SQL component to collect table sources
        this.visit(query);
        return this.getTableSources();
    }

    /**
     * Main entry point for the visitor pattern.
     * Implements the shallow visit pattern to distinguish between root and recursive visits.
     */
    public visit(arg: SqlComponent): void {
        // If not a root visit, just visit the node and return
        if (!this.isRootVisit) {
            this.visitNode(arg);
            return;
        }

        // If this is a root visit, we need to reset the state
        this.reset();
        this.isRootVisit = false;

        try {
            // When in full scan mode, collect CTEs first to exclude them from table sources
            if (!this.selectableOnly) {
                this.collectCTEs(arg);
            }
            this.visitNode(arg);
        } finally {
            // Regardless of success or failure, reset the root visit flag
            this.isRootVisit = true;
        }
    }

    /**
     * Internal visit method used for all nodes.
     * This separates the visit flag management from the actual node visitation logic.
     */
    private visitNode(arg: SqlComponent): void {
        // Skip if we've already visited this node to prevent infinite recursion
        if (this.visitedNodes.has(arg)) {
            return;
        }

        // Mark as visited
        this.visitedNodes.add(arg);

        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            handler(arg);
            return;
        }

        // If no handler found, that's ok - we only care about specific components
    }

    /**
     * Collects all CTE names to exclude them from real table sources
     */
    private collectCTEs(query: SqlComponent): void {
        // Use CommonTableCollector to get all CTEs
        const cteCollector = new CTECollector();
        cteCollector.visit(query);
        const commonTables = cteCollector.getCommonTables();

        // Add CTE names to the set
        for (const cte of commonTables) {
            // aliasExpression.table is TableSource, so use .table getter (IdentifierString)
            this.cteNames.add(cte.aliasExpression.table.name);
        }
    }

    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        // Process the FROM and JOIN clauses
        if (query.fromClause) {
            query.fromClause.accept(this);
        }

        // If in full scan mode, visit all other clauses too
        if (!this.selectableOnly) {
            if (query.withClause) {
                query.withClause.accept(this);
            }

            if (query.whereClause) {
                query.whereClause.accept(this);
            }

            if (query.groupByClause) {
                query.groupByClause.accept(this);
            }

            if (query.havingClause) {
                query.havingClause.accept(this);
            }

            if (query.orderByClause) {
                query.orderByClause.accept(this);
            }

            if (query.windowClause) {
                for (const win of query.windowClause.windows) {
                    win.accept(this);
                }
            }

            if (query.limitClause) {
                query.limitClause.accept(this);
            }

            if (query.offsetClause) {
                query.offsetClause.accept(this);
            }

            if (query.fetchClause) {
                query.fetchClause.accept(this);
            }

            if (query.forClause) {
                query.forClause.accept(this);
            }

            query.selectClause.accept(this);
        }
    }

    private visitBinarySelectQuery(query: BinarySelectQuery): void {
        // For UNION-like queries, visit both sides
        query.left.accept(this);
        query.right.accept(this);
    }

    private visitValuesQuery(query: ValuesQuery): void {
        if (!this.selectableOnly) {
            // VALUES queries might contain subqueries in tuple expressions
            for (const tuple of query.tuples) {
                tuple.accept(this);
            }
        }
    }

    private visitWithClause(withClause: WithClause): void {
        if (!this.selectableOnly) {
            // Visit each CommonTable
            for (const table of withClause.tables) {
                table.accept(this);
            }
        }
    }

    private visitCommonTable(commonTable: CommonTable): void {
        if (!this.selectableOnly) {
            // Process the query within the common table
            commonTable.query.accept(this);
        }
    }

    private visitFromClause(fromClause: FromClause): void {
        // Check the main source in FROM clause
        fromClause.source.accept(this);

        // Check all JOIN clauses
        if (fromClause.joins) {
            for (const join of fromClause.joins) {
                join.accept(this);
            }
        }
    }

    private visitSourceExpression(source: SourceExpression): void {
        // Process the actual data source, ignoring aliases
        source.datasource.accept(this);
    }

    private visitTableSource(source: TableSource): void {
        // Get the table identifier for uniqueness check
        const identifier = this.getTableIdentifier(source);

        // Check if this is a table managed by a CTE
        if (!this.tableNameMap.has(identifier) && !this.isCTETable(source.table.name)) {
            this.tableNameMap.set(identifier, true);
            this.tableSources.push(source);
        }
    }

    /**
     * Checks if a table name is a CTE name
     */
    private isCTETable(tableName: string): boolean {
        return this.cteNames.has(tableName);
    }

    private visitParenSource(source: ParenSource): void {
        // For parenthesized sources, visit the inner source
        source.source.accept(this);
    }

    private visitSubQuerySource(subQuery: SubQuerySource): void {
        if (!this.selectableOnly) {
            // In full scan mode, we also check subqueries
            subQuery.query.accept(this);
        }
        // In selectableOnly mode, we don't collect sources from subqueries
    }

    private visitInlineQuery(inlineQuery: InlineQuery): void {
        if (!this.selectableOnly) {
            // In full scan mode, visit inline queries too
            inlineQuery.selectQuery.accept(this);
        }
    }

    private visitJoinClause(joinClause: JoinClause): void {
        // Visit the source being joined
        joinClause.source.accept(this);

        // If full scanning, also visit the join condition
        if (!this.selectableOnly && joinClause.condition) {
            joinClause.condition.accept(this);
        }
    }

    private visitJoinOnClause(joinOn: JoinOnClause): void {
        if (!this.selectableOnly) {
            // In full scan mode, check ON condition for table references
            joinOn.condition.accept(this);
        }
    }

    private visitJoinUsingClause(joinUsing: JoinUsingClause): void {
        if (!this.selectableOnly) {
            // In full scan mode, check USING condition for table references
            joinUsing.condition.accept(this);
        }
    }

    // Additional visitor methods only used in full scan mode

    private visitWhereClause(whereClause: WhereClause): void {
        whereClause.condition.accept(this);
    }

    private visitGroupByClause(clause: GroupByClause): void {
        for (const item of clause.grouping) {
            item.accept(this);
        }
    }

    private visitHavingClause(clause: HavingClause): void {
        clause.condition.accept(this);
    }

    private visitOrderByClause(clause: OrderByClause): void {
        for (const item of clause.order) {
            item.accept(this);
        }
    }

    private visitWindowFrameClause(clause: WindowFrameClause): void {
        clause.expression.accept(this);
    }

    private visitLimitClause(clause: LimitClause): void {
        clause.value.accept(this);
    }

    private visitOffsetClause(clause: OffsetClause): void {
        clause.value.accept(this);
    }

    private visitFetchClause(clause: FetchClause): void {
        clause.expression.accept(this);
    }

    private visitForClause(clause: ForClause): void {
        // FOR clause doesn't contain table sources
    }

    private visitOrderByItem(item: OrderByItem): void {
        item.value.accept(this);
    }

    private visitSelectClause(clause: SelectClause): void {
        for (const item of clause.items) {
            item.accept(this);
        }
    }

    private visitSelectItem(item: SelectItem): void {
        item.value.accept(this);
    }

    private visitParenExpression(expr: ParenExpression): void {
        expr.expression.accept(this);
    }

    private visitBinaryExpression(expr: BinaryExpression): void {
        expr.left.accept(this);
        expr.right.accept(this);
    }

    private visitUnaryExpression(expr: UnaryExpression): void {
        expr.expression.accept(this);
    }

    private visitCaseExpression(expr: CaseExpression): void {
        if (expr.condition) {
            expr.condition.accept(this);
        }
        expr.switchCase.accept(this);
    }

    private visitSwitchCaseArgument(switchCase: SwitchCaseArgument): void {
        for (const caseItem of switchCase.cases) {
            caseItem.accept(this);
        }

        if (switchCase.elseValue) {
            switchCase.elseValue.accept(this);
        }
    }

    private visitCaseKeyValuePair(pair: CaseKeyValuePair): void {
        pair.key.accept(this);
        pair.value.accept(this);
    }

    private visitBetweenExpression(expr: BetweenExpression): void {
        expr.expression.accept(this);
        expr.lower.accept(this);
        expr.upper.accept(this);
    }

    private visitFunctionCall(func: FunctionCall): void {
        if (func.argument) {
            func.argument.accept(this);
        }

        if (func.over) {
            func.over.accept(this);
        }
    }

    private visitArrayExpression(expr: ArrayExpression): void {
        expr.expression.accept(this);
    }

    private visitTupleExpression(expr: TupleExpression): void {
        for (const value of expr.values) {
            value.accept(this);
        }
    }

    private visitCastExpression(expr: CastExpression): void {
        expr.input.accept(this);
        expr.castType.accept(this);
    }
}