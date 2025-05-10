import { CommonTable, ForClause, FromClause, GroupByClause, HavingClause, JoinClause, JoinOnClause, JoinUsingClause, LimitClause, OrderByClause, OrderByItem, ParenSource, PartitionByClause, SelectClause, SelectItem, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WindowsClause, WithClause } from "../models/Clause";
import { BinarySelectQuery, SimpleSelectQuery, SelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import {
    ArrayExpression, BetweenExpression, BinaryExpression, CaseExpression, CaseKeyValuePair,
    CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression,
    ParameterExpression, SwitchCaseArgument, TupleExpression, UnaryExpression, ValueComponent,
    OverExpression, WindowFrameExpression, IdentifierString, RawString,
    WindowFrameSpec,
    LiteralValue,
    TypeValue,
    ValueList
} from "../models/ValueComponent";

/**
 * A visitor that collects all CommonTable instances from a SQL query structure.
 * This includes tables from:
 * - WITH clauses
 * - Subqueries
 * - Inline queries
 * - UNION queries
 * - Value components that may contain queries
 */
export class CTECollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private commonTables: CommonTable[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();
    private isRootVisit: boolean = true;

    constructor() {
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Setup handlers for all component types that might contain CommonTables

        // SelectQuery types
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
        this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));

        // WITH clause that directly contains CommonTables
        this.handlers.set(WithClause.kind, (expr) => this.visitWithClause(expr as WithClause));
        this.handlers.set(CommonTable.kind, (expr) => this.visitCommonTable(expr as CommonTable));

        // SelectComponent types
        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));

        // Identifiers and raw strings (leaf nodes that don't need traversal)
        this.handlers.set(IdentifierString.kind, (expr) => this.visitIdentifierString(expr as IdentifierString));
        this.handlers.set(RawString.kind, (expr) => this.visitRawString(expr as RawString));
        this.handlers.set(ColumnReference.kind, (expr) => this.visitColumnReference(expr as ColumnReference));
        this.handlers.set(ParameterExpression.kind, (expr) => this.visitParameterExpression(expr as ParameterExpression));
        this.handlers.set(LiteralValue.kind, (expr) => this.visitLiteralValue(expr as LiteralValue));

        // Source components
        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));
        this.handlers.set(ParenSource.kind, (expr) => this.visitParenSource(expr as ParenSource));

        // Subqueries and inline queries
        this.handlers.set(SubQuerySource.kind, (expr) => this.visitSubQuerySource(expr as SubQuerySource));
        this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));

        // FROM and JOIN clauses
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(JoinClause.kind, (expr) => this.visitJoinClause(expr as JoinClause));
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        // WHERE clause
        this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));

        // Value components that might contain subqueries
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
        this.handlers.set(WindowFrameExpression.kind, (expr) => this.visitWindowFrameExpression(expr as WindowFrameExpression));
        this.handlers.set(WindowFrameSpec.kind, (expr) => this.visitWindowFrameSpec(expr as WindowFrameSpec));
        this.handlers.set(TypeValue.kind, (expr) => this.visitTypeValue(expr as TypeValue));
        this.handlers.set(ValueList.kind, (expr) => this.visitValueList(expr as ValueList));

        // Add handlers for other clause types
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr as OrderByItem));
        this.handlers.set(PartitionByClause.kind, (expr) => this.visitPartitionByClause(expr as PartitionByClause));
    }

    /**
     * Get all collected CommonTables
     */
    public getCommonTables(): CommonTable[] {
        return this.commonTables;
    }

    /**
     * Reset the collection of CommonTables
     */
    private reset(): void {
        this.commonTables = [];
        this.visitedNodes.clear();
    }

    public collect(query: SelectQuery): CommonTable[] {
        // Visit the query to collect all CommonTables
        this.visit(query);
        return this.getCommonTables();
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

        // Provide more detailed error message
        const kindSymbol = arg.getKind()?.toString() || 'unknown';
        const constructor = arg.constructor?.name || 'unknown';
        throw new Error(`[CTECollector] No handler for ${constructor} with kind ${kindSymbol}.`);
    }

    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        // The order matters here!
        // First, visit all clauses that might contain nested CTEs
        // to ensure inner CTEs are collected before outer CTEs

        // Check FROM clause first (can contain subqueries with nested CTEs)
        if (query.fromClause) {
            query.fromClause.accept(this);
        }

        // Check WHERE clause (can contain subqueries with WITH clauses)
        if (query.whereClause) {
            query.whereClause.accept(this);
        }

        // Check other clauses that might contain CTEs
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

        if (query.forClause) {
            query.forClause.accept(this);
        }

        // Check SELECT clause
        query.selectClause.accept(this);

        // Finally check the WITH clause after all nested CTEs have been collected
        // This ensures inner CTEs are collected before outer CTEs
        if (query.withClause) {
            query.withClause.accept(this);
        }

    }

    private visitBinarySelectQuery(query: BinarySelectQuery): void {
        // Visit both sides of the binary query (UNION, EXCEPT, etc.)
        query.left.accept(this);
        query.right.accept(this);
    }

    private visitValuesQuery(query: ValuesQuery): void {
        // VALUES queries might contain subqueries in tuple expressions
        for (const tuple of query.tuples) {
            tuple.accept(this);
        }
    }

    private visitWithClause(withClause: WithClause): void {
        // Visit each CommonTable
        // Simply process tables in sequence
        // Note: visitCommonTable already handles nested CTEs
        for (let i = 0; i < withClause.tables.length; i++) {
            const commonTable = withClause.tables[i];
            commonTable.accept(this);
        }
    }

    private visitCommonTable(commonTable: CommonTable): void {
        // Process CommonTable directly within the query
        // Use the same instance to process the query instead of creating another Collector
        commonTable.query.accept(this);

        // Add current CTE after all nested CTEs have been added
        this.commonTables.push(commonTable);
    }

    private visitSelectClause(clause: SelectClause): void {
        // Check each item in the select clause
        for (const item of clause.items) {
            item.accept(this);
        }
    }

    private visitSelectItem(item: SelectItem): void {
        // Select items might contain subqueries
        item.value.accept(this);
    }

    private visitFromClause(fromClause: FromClause): void {
        // Check the source
        fromClause.source.accept(this);

        // Check joins
        if (fromClause.joins) {
            for (const join of fromClause.joins) {
                join.accept(this);
            }
        }
    }

    private visitSourceExpression(source: SourceExpression): void {
        source.datasource.accept(this);
        // The alias part doesn't contain subqueries so we skip it
    }

    private visitTableSource(source: TableSource): void {
        // Table sources don't contain subqueries, nothing to do
    }

    private visitParenSource(source: ParenSource): void {
        source.source.accept(this);
    }

    private visitSubQuerySource(subQuery: SubQuerySource): void {
        subQuery.query.accept(this);
    }

    private visitInlineQuery(inlineQuery: InlineQuery): void {
        inlineQuery.selectQuery.accept(this);
    }

    private visitJoinClause(joinClause: JoinClause): void {
        // Check join source
        joinClause.source.accept(this);

        // Check join condition
        if (joinClause.condition) {
            joinClause.condition.accept(this);
        }
    }

    private visitJoinOnClause(joinOn: JoinOnClause): void {
        joinOn.condition.accept(this);
    }

    private visitJoinUsingClause(joinUsing: JoinUsingClause): void {
        joinUsing.condition.accept(this);
    }

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

    private visitForClause(clause: ForClause): void {
        // FOR clause doesn't contain subqueries
    }

    private visitOrderByItem(item: OrderByItem): void {
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
        // Check all case expressions
        for (const caseItem of switchCase.cases) {
            caseItem.accept(this);
        }

        // Check ELSE expression
        if (switchCase.elseValue) {
            switchCase.elseValue.accept(this);
        }
    }

    private visitCaseKeyValuePair(pair: CaseKeyValuePair): void {
        // Check the WHEN condition
        pair.key.accept(this);
        // Check the THEN value
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

        // Check OVER clause if present
        if (func.over) {
            func.over.accept(this);
        }
    }

    private visitArrayExpression(expr: ArrayExpression): void {
        expr.expression.accept(this);
    }

    private visitTupleExpression(expr: TupleExpression): void {
        // Check each value in the tuple for possible subqueries
        for (const value of expr.values) {
            value.accept(this);
        }
    }

    private visitCastExpression(expr: CastExpression): void {
        // Check the input expression
        expr.input.accept(this);
        // Check the type expression
        expr.castType.accept(this);
    }

    private visitTypeValue(expr: TypeValue): void {
        // Visit the argument if present
        if (expr.argument) {
            expr.argument.accept(this);
        }
        // The type itself doesn't contain subqueries
    }

    private visitWindowFrameExpression(expr: WindowFrameExpression): void {
        if (expr.partition) {
            expr.partition.accept(this);
        }
        if (expr.order) {
            expr.order.accept(this);
        }
        if (expr.frameSpec) {
            expr.frameSpec.accept(this);
        }
    }

    private visitWindowFrameSpec(spec: WindowFrameSpec): void {
        // WindowFrameSpec is a simple value object, nothing to traverse
    }

    private visitIdentifierString(ident: IdentifierString): void {
        // Leaf node, nothing to traverse
    }

    private visitRawString(raw: RawString): void {
        // Leaf node, nothing to traverse
    }

    private visitColumnReference(column: ColumnReference): void {
        // Column references don't have subqueries
    }

    private visitParameterExpression(param: ParameterExpression): void {
        // Parameter expressions don't have child components
    }

    private visitLiteralValue(value: LiteralValue): void {
        // Literal values are leaf nodes
    }

    public visitPartitionByClause(partitionBy: PartitionByClause): void {
        // don't have subqueries
    }

    public visitValueList(valueList: ValueList): void {
        for (const value of valueList.values) {
            value.accept(this);
        }
    }
}