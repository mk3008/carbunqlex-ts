import { CommonTable, ForClause, FromClause, GroupByClause, HavingClause, JoinClause, JoinConditionComponent, JoinOnClause, JoinUsingClause, LimitClause, OrderByClause, OrderByComponent, OrderByItem, ParenSource, PartitionByClause, SelectClause, SelectItem, SourceAliasExpression, SourceComponent, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WindowsClause, WithClause } from "../models/Clause";
import { BinarySelectQuery, SimpleSelectQuery, SelectQuery, ValuesQuery } from "../models/SelectQuery";
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

/**
 * A visitor that disables all WITH clauses in a SQL query structure.
 * This processes and removes WITH clauses from:
 * - Simple SELECT queries
 * - Binary queries (UNION, EXCEPT, etc.)
 * - Subqueries
 * - Inline queries
 * 
 * It maintains the CTE queries themselves but restructures the query to not use
 * the WITH clause syntactical construct.
 */
export class CTEDisabler implements SqlComponentVisitor<SqlComponent> {
    private handlers: Map<symbol, (arg: any) => SqlComponent>;
    private visitedNodes: Set<SqlComponent> = new Set();
    private isRootVisit: boolean = true;

    constructor() {
        this.handlers = new Map<symbol, (arg: any) => SqlComponent>();

        // Setup handlers for all component types that might contain WITH clauses

        // SelectQuery types
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
        this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));

        // SelectComponent types
        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));

        // Identifiers and raw strings
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

        // Add handlers for other clause types
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr as OrderByItem));
    }

    /**
     * Reset the visited nodes tracking
     */
    private reset(): void {
        this.visitedNodes.clear();
    }

    public execute(arg: SqlComponent): SelectQuery {
        // Reset the visited nodes before starting the visit
        this.reset();
        return this.visit(arg) as SelectQuery;
    }

    /**
     * Main entry point for the visitor pattern.
     * Implements the shallow visit pattern to distinguish between root and recursive visits.
     */
    public visit(arg: SqlComponent): SqlComponent {
        // If not a root visit, just visit the node and return
        if (!this.isRootVisit) {
            return this.visitNode(arg);
        }

        // If this is a root visit, we need to reset the state
        this.reset();
        this.isRootVisit = false;

        try {
            return this.visitNode(arg);
        } finally {
            // Regardless of success or failure, reset the root visit flag
            this.isRootVisit = true;
        }
    }

    /**
     * Internal visit method used for all nodes.
     * This separates the visit flag management from the actual node visitation logic.
     */
    private visitNode(arg: SqlComponent): SqlComponent {
        // Check for circular references - if node already visited, return as is
        if (this.visitedNodes.has(arg)) {
            return arg;
        }

        // Mark as visited node
        this.visitedNodes.add(arg);

        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            return handler(arg);
        }

        // Provide more detailed error message
        const kindSymbol = arg.getKind()?.toString() || 'unknown';
        const constructor = arg.constructor?.name || 'unknown';
        throw new Error(`[CTEDisabler] No handler for ${constructor} with kind ${kindSymbol}.`);
    }

    visitSimpleSelectQuery(arg: SimpleSelectQuery): SqlComponent {
        if (arg.withClause) {
            arg.withClause.tables.forEach(table => {
                this.visit(table.query);
            });
        }

        arg.withClause = null; // Explicitly remove WITH clause

        // Visit the components of the SimpleSelectQuery
        arg.selectClause = this.visit(arg.selectClause) as SelectClause;
        arg.fromClause = arg.fromClause ? this.visit(arg.fromClause) as FromClause : null;
        arg.whereClause = arg.whereClause ? this.visit(arg.whereClause) as WhereClause : null;
        arg.groupByClause = arg.groupByClause ? this.visit(arg.groupByClause) as GroupByClause : null;
        arg.havingClause = arg.havingClause ? this.visit(arg.havingClause) as HavingClause : null;
        arg.orderByClause = arg.orderByClause ? this.visit(arg.orderByClause) as OrderByClause : null;
        if (arg.windowClause) {
            arg.windowClause = new WindowsClause(arg.windowClause.windows.map(w => this.visit(w) as WindowFrameClause));
        }
        arg.limitClause = arg.limitClause ? this.visit(arg.limitClause) as LimitClause : null;
        arg.forClause = arg.forClause ? this.visit(arg.forClause) as ForClause : null;
        return arg;
    }

    visitBinarySelectQuery(query: BinarySelectQuery): SqlComponent {
        query.left = this.visit(query.left) as SelectQuery;
        query.right = this.visit(query.right) as SelectQuery;
        return query;
    }

    visitValuesQuery(query: ValuesQuery): SqlComponent {
        const newTuples = query.tuples.map(tuple => this.visit(tuple) as TupleExpression);
        return new ValuesQuery(newTuples);
    }

    visitSelectClause(clause: SelectClause): SqlComponent {
        const newItems = clause.items.map(item => {
            return this.visit(item) as SelectItem;
        });

        return new SelectClause(
            newItems,
            clause.distinct,
        );
    }

    visitFromClause(clause: FromClause): SqlComponent {
        const newSource = this.visit(clause.source) as SourceExpression;
        const newJoins = clause.joins ? clause.joins.map(join => this.visit(join) as JoinClause) : null;

        return new FromClause(newSource, newJoins);
    }

    visitSubQuerySource(subQuery: SubQuerySource): SqlComponent {
        const newQuery = this.visit(subQuery.query) as SelectQuery;
        return new SubQuerySource(newQuery);
    }

    visitInlineQuery(inlineQuery: InlineQuery): SqlComponent {
        const newQuery = this.visit(inlineQuery.selectQuery) as SelectQuery;
        return new InlineQuery(newQuery);
    }

    visitJoinClause(joinClause: JoinClause): SqlComponent {
        const newSource = this.visit(joinClause.source) as SourceExpression;
        const newCondition = joinClause.condition ? this.visit(joinClause.condition) as JoinConditionComponent : null;

        return new JoinClause(
            joinClause.joinType.value,
            newSource,
            newCondition,
            joinClause.lateral,
        );
    }

    visitJoinOnClause(joinOn: JoinOnClause): SqlComponent {
        const newCondition = this.visit(joinOn.condition) as ValueComponent;
        return new JoinOnClause(newCondition);
    }

    visitJoinUsingClause(joinUsing: JoinUsingClause): SqlComponent {
        const newCondition = this.visit(joinUsing.condition) as ValueComponent;
        return new JoinUsingClause(newCondition);
    }

    visitWhereClause(whereClause: WhereClause): SqlComponent {
        const newCondition = this.visit(whereClause.condition) as ValueComponent;
        return new WhereClause(newCondition);
    }

    visitGroupByClause(clause: GroupByClause): SqlComponent {
        const newGrouping = clause.grouping.map(item => this.visit(item) as ValueComponent);
        return new GroupByClause(newGrouping);
    }

    visitHavingClause(clause: HavingClause): SqlComponent {
        const newCondition = this.visit(clause.condition) as ValueComponent;
        return new HavingClause(newCondition);
    }

    visitOrderByClause(clause: OrderByClause): SqlComponent {
        const newOrder = clause.order.map(item => this.visit(item) as OrderByComponent);
        return new OrderByClause(newOrder);
    }

    visitWindowFrameClause(clause: WindowFrameClause): SqlComponent {
        const newExpression = this.visit(clause.expression) as WindowFrameExpression;
        return new WindowFrameClause(clause.name.name, newExpression);
    }

    visitLimitClause(clause: LimitClause): SqlComponent {
        const newLimit = this.visit(clause.value) as ValueComponent;
        return new LimitClause(newLimit);
    }

    visitForClause(clause: ForClause): SqlComponent {
        return new ForClause(clause.lockMode);
    }

    visitParenExpression(expr: ParenExpression): SqlComponent {
        const newExpression = this.visit(expr.expression) as ValueComponent;
        return new ParenExpression(newExpression);
    }

    visitBinaryExpression(expr: BinaryExpression): SqlComponent {
        const newLeft = this.visit(expr.left) as ValueComponent;
        const newRight = this.visit(expr.right) as ValueComponent;
        return new BinaryExpression(newLeft, expr.operator.value, newRight);
    }

    visitUnaryExpression(expr: UnaryExpression): SqlComponent {
        const newExpression = this.visit(expr.expression) as ValueComponent;
        return new UnaryExpression(expr.operator.value, newExpression);
    }

    visitCaseExpression(expr: CaseExpression): SqlComponent {
        const newCondition = expr.condition ? this.visit(expr.condition) as ValueComponent : null;
        const newSwitchCase = this.visit(expr.switchCase) as SwitchCaseArgument;
        return new CaseExpression(newCondition, newSwitchCase);
    }

    visitSwitchCaseArgument(switchCase: SwitchCaseArgument): SqlComponent {
        const newCases = switchCase.cases.map(caseItem => this.visit(caseItem) as CaseKeyValuePair);
        const newElseValue = switchCase.elseValue ? this.visit(switchCase.elseValue) as ValueComponent : null;
        return new SwitchCaseArgument(newCases, newElseValue);
    }

    visitCaseKeyValuePair(pair: CaseKeyValuePair): SqlComponent {
        const newKey = this.visit(pair.key) as ValueComponent;
        const newValue = this.visit(pair.value) as ValueComponent;
        return new CaseKeyValuePair(newKey, newValue);
    }

    visitBetweenExpression(expr: BetweenExpression): SqlComponent {
        const newExpression = this.visit(expr.expression) as ValueComponent;
        const newLower = this.visit(expr.lower) as ValueComponent;
        const newUpper = this.visit(expr.upper) as ValueComponent;
        return new BetweenExpression(newExpression, newLower, newUpper, expr.negated);
    }

    visitFunctionCall(func: FunctionCall): SqlComponent {
        const newArgument = func.argument ? this.visit(func.argument) as ValueComponent : null;
        const newOver = func.over ? this.visit(func.over) as OverExpression : null;
        return new FunctionCall(func.namespaces, func.name, newArgument, newOver);
    }

    visitArrayExpression(expr: ArrayExpression): SqlComponent {
        const newExpression = this.visit(expr.expression) as ValueComponent;
        return new ArrayExpression(newExpression);
    }

    visitTupleExpression(expr: TupleExpression): SqlComponent {
        const newValues = expr.values.map(value => this.visit(value) as ValueComponent);
        return new TupleExpression(newValues);
    }

    visitCastExpression(expr: CastExpression): SqlComponent {
        const newInput = this.visit(expr.input) as ValueComponent;
        const newCastType = this.visit(expr.castType) as TypeValue;
        return new CastExpression(newInput, newCastType);
    }

    visitTypeValue(typeValue: TypeValue): SqlComponent {
        const newArgument = typeValue.argument ? this.visit(typeValue.argument) as ValueComponent : null;
        return new TypeValue(typeValue.namespaces, typeValue.name, newArgument);
    }

    visitSelectItem(item: SelectItem): SqlComponent {
        const newValue = this.visit(item.value) as ValueComponent;
        return new SelectItem(newValue, item.identifier?.name);
    }

    visitIdentifierString(ident: IdentifierString): SqlComponent {
        // Identifiers don't have child components, so just return as-is
        return ident;
    }

    visitRawString(raw: RawString): SqlComponent {
        // Raw strings don't have child components, so just return as-is
        return raw;
    }

    visitColumnReference(column: ColumnReference): SqlComponent {
        // Column references don't have subqueries, so just return as-is
        return column;
    }

    visitSourceExpression(source: SourceExpression): SqlComponent {
        const newSource = this.visit(source.datasource) as SourceComponent;
        // SourceAliasEpression don't contain subqueries, so just return as-is
        const newAlias = source.aliasExpression;
        return new SourceExpression(newSource, newAlias);
    }

    visitTableSource(source: TableSource): SqlComponent {
        // Table sources don't contain subqueries, so just return as-is
        return source;
    }

    visitParenSource(source: ParenSource): SqlComponent {
        const newSource = this.visit(source.source) as SourceComponent;
        return new ParenSource(newSource);
    }

    visitParameterExpression(param: ParameterExpression): SqlComponent {
        // Parameter expressions don't have child components, so just return as-is
        return param;
    }

    visitWindowFrameExpression(expr: WindowFrameExpression): SqlComponent {
        const newPartition = expr.partition ? this.visit(expr.partition) as PartitionByClause : null;
        const newOrder = expr.order ? this.visit(expr.order) as OrderByClause : null;
        const newFrameSpec = expr.frameSpec ? this.visit(expr.frameSpec) as WindowFrameSpec : null;

        return new WindowFrameExpression(
            newPartition,
            newOrder,
            newFrameSpec
        );
    }

    visitWindowFrameSpec(spec: WindowFrameSpec): SqlComponent {
        // WindowFrameSpec is a simple value object, so return as-is
        return spec;
    }

    visitLiteralValue(value: ValueComponent): SqlComponent {
        // Literal values are returned as-is
        return value;
    }

    visitOrderByItem(item: OrderByItem): SqlComponent {
        const newValue = this.visit(item.value) as ValueComponent;
        return new OrderByItem(newValue, item.sortDirection, item.nullsPosition);
    }
}