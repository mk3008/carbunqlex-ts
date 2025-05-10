import { CommonTable, ForClause, FromClause, GroupByClause, HavingClause, LimitClause, OrderByClause, SelectClause, WhereClause, WindowFrameClause, WindowsClause, JoinClause, JoinOnClause, JoinUsingClause, TableSource, SubQuerySource, SourceExpression, SelectItem, PartitionByClause, FetchClause, OffsetClause } from "../models/Clause";
import { SimpleSelectQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { ArrayExpression, BetweenExpression, BinaryExpression, CaseExpression, CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression, UnaryExpression, ValueComponent, ValueList, WindowFrameExpression } from "../models/ValueComponent";
import { CTECollector } from "./CTECollector";
import { Formatter } from "./Formatter";
import { SelectValueCollector } from "./SelectValueCollector";
import { TableColumnResolver } from "./TableColumnResolver";

/**
 * A visitor that collects all ColumnReference instances from a SQL query structure.
 * This visitor scans through all clauses and collects all unique ColumnReference objects.
 * It does not scan Common Table Expressions (CTEs) or subqueries.
 * 
 * Important: Only collects column references to tables defined in the root FROM/JOIN clauses,
 * as these are the only columns that can be directly referenced in the query.
 */
export class SelectableColumnCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private selectValues: { name: string, value: ValueComponent }[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();
    private formatter: Formatter;
    private isRootVisit: boolean = true;
    private tableColumnResolver: TableColumnResolver | null = null;
    private commonTableCollector: CTECollector;
    private selectValueCollector: SelectValueCollector;
    private commonTables: CommonTable[] = [];

    constructor(tableColumnResolver?: TableColumnResolver | null) {
        this.tableColumnResolver = tableColumnResolver ?? null;
        this.selectValueCollector = new SelectValueCollector();
        this.commonTableCollector = new CTECollector();
        this.commonTables = [];

        this.formatter = new Formatter();

        this.handlers = new Map<symbol, (arg: any) => void>();

        // Main entry point is the SimpleSelectQuery
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));

        // Handlers for each clause type that might contain column references
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(OffsetClause.kind, (expr) => this.offsetClause(expr as OffsetClause));
        this.handlers.set(FetchClause.kind, (expr) => this.visitFetchClause(expr as FetchClause));

        // Add handlers for JOIN conditions
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        // For value components that might contain column references
        this.handlers.set(ColumnReference.kind, (expr) => this.visitColumnReference(expr as ColumnReference));
        this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
        this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
        this.handlers.set(ValueList.kind, (expr) => this.visitValueList(expr as ValueList));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(WindowFrameExpression.kind, (expr) => this.visitWindowFrameExpression(expr as WindowFrameExpression));
        this.handlers.set(PartitionByClause.kind, (expr) => this.visitPartitionByClause(expr as PartitionByClause));
    }

    public getValues(): { name: string, value: ValueComponent }[] {
        return this.selectValues;
    }

    public collect(arg: SqlComponent): { name: string, value: ValueComponent }[] {
        // Visit the component and return the collected select items
        this.visit(arg);
        const items = this.getValues();
        this.reset(); // Reset after collection
        return items;
    }

    /**
     * Reset the collection of ColumnReferences
     */
    private reset(): void {
        this.selectValues = []
        this.visitedNodes.clear();
        this.commonTables = [];
    }

    private addSelectValueAsUnique(name: string, value: ValueComponent): void {
        // Check if a select value with the same name already exists before adding
        if (!this.selectValues.some(item => item.name === name)) {
            this.selectValues.push({ name, value });
        }
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

        if (!(arg instanceof SimpleSelectQuery)) {
            throw new Error("Root visit must be a SimpleSelectQuery");
        }

        // If this is a root visit, we need to reset the state
        this.reset();
        this.isRootVisit = false;
        this.commonTables = this.commonTableCollector.collect(arg);

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

        // For any other component types, we don't need to do anything
    }

    /**
      * Process a SimpleSelectQuery to collect ColumnReferences from all its clauses
      */
    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        // Visit all clauses that might contain column references
        if (query.selectClause) {
            query.selectClause.accept(this);
        }

        if (query.fromClause) {
            query.fromClause.accept(this);
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

        if (query.windowClause) {
            for (const win of query.windowClause.windows) {
                win.accept(this);
            }
        }

        if (query.orderByClause) {
            query.orderByClause.accept(this);
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

        // Explicitly NOT processing query.WithClause to avoid scanning CTEs
    }

    // Clause handlers
    private visitSelectClause(clause: SelectClause): void {
        for (const item of clause.items) {
            if (item.identifier) {
                this.addSelectValueAsUnique(item.identifier.name, item.value);
            }
            item.value.accept(this);
        }
    }

    private visitFromClause(clause: FromClause): void {
        // import source values
        const collector = new SelectValueCollector(this.tableColumnResolver, this.commonTables);
        const sourceValues = collector.collect(clause);
        for (const item of sourceValues) {
            // Add the select value as unique to avoid duplicates
            this.addSelectValueAsUnique(item.name, item.value);
        }

        if (clause.joins) {
            for (const join of clause.joins) {
                if (join.condition) {
                    join.condition.accept(this);
                }
            }
        }
    }

    private visitWhereClause(clause: WhereClause): void {
        if (clause.condition) {
            clause.condition.accept(this);
        }
    }

    private visitGroupByClause(clause: GroupByClause): void {
        if (clause.grouping) {
            for (const item of clause.grouping) {
                item.accept(this);
            }
        }
    }

    private visitHavingClause(clause: HavingClause): void {
        if (clause.condition) {
            clause.condition.accept(this);
        }
    }

    private visitOrderByClause(clause: OrderByClause): void {
        if (clause.order) {
            for (const item of clause.order) {
                item.accept(this);
            }
        }
    }

    private visitWindowFrameClause(clause: WindowFrameClause): void {
        clause.expression.accept(this);
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

    private visitLimitClause(clause: LimitClause): void {
        if (clause.value) {
            clause.value.accept(this);
        }
    }

    private offsetClause(clause: OffsetClause): void {
        if (clause.value) {
            clause.value.accept(this);
        }
    }

    private visitFetchClause(clause: FetchClause): void {
        if (clause.expression) {
            clause.expression.accept(this);
        }
    }

    private visitJoinOnClause(joinOnClause: JoinOnClause): void {
        // Visit the join condition
        if (joinOnClause.condition) {
            joinOnClause.condition.accept(this);
        }
    }

    private visitJoinUsingClause(joinUsingClause: JoinUsingClause): void {
        // Visit the columns in the USING clause
        if (joinUsingClause.condition) {
            joinUsingClause.condition.accept(this);
        }
    }

    // Value component handlers
    private visitColumnReference(columnRef: ColumnReference): void {
        // Wildcards are ignored because they cannot be reused even if detected
        if (columnRef.column.name !== "*") {
            this.addSelectValueAsUnique(columnRef.column.name, columnRef);
        }
    }

    private visitBinaryExpression(expr: BinaryExpression): void {
        // Visit both sides of the expression
        if (expr.left) {
            expr.left.accept(this);
        }
        if (expr.right) {
            expr.right.accept(this);
        }
    }

    private visitUnaryExpression(expr: UnaryExpression): void {
        if (expr.expression) {
            expr.expression.accept(this);
        }
    }

    private visitFunctionCall(func: FunctionCall): void {
        if (func.argument) {
            func.argument.accept(this);
        }
        if (func.over) {
            func.over.accept(this);
        }
    }

    private visitParenExpression(expr: ParenExpression): void {
        if (expr.expression) {
            expr.expression.accept(this);
        }
    }

    private visitCaseExpression(expr: CaseExpression): void {
        if (expr.condition) {
            expr.condition.accept(this);
        }

        if (expr.switchCase) {
            expr.switchCase.accept(this);
        }
    }

    private visitCastExpression(expr: CastExpression): void {
        if (expr.input) {
            expr.input.accept(this);
        }
    }

    private visitBetweenExpression(expr: BetweenExpression): void {
        if (expr.expression) {
            expr.expression.accept(this);
        }

        if (expr.lower) {
            expr.lower.accept(this);
        }

        if (expr.upper) {
            expr.upper.accept(this);
        }
    }

    private visitArrayExpression(expr: ArrayExpression): void {
        if (expr.expression) {
            expr.expression.accept(this);
        }
    }

    private visitValueList(expr: ValueList): void {
        if (expr.values) {
            for (const value of expr.values) {
                value.accept(this);
            }
        }
    }

    private visitPartitionByClause(clause: PartitionByClause): void {
        clause.value.accept(this);
    }
}