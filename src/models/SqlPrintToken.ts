export enum SqlPrintTokenType {
    container = 0,
    keyword,
    value, // Represents non-keyword elements such as table names
    comma, // Represents comma ','
    parenthesis, // Represents parentheses: ( ) { } [ ]
    operator, // Represents operators such as +, -, *, /
    comment,
    parameter,
    dot,
    type,
    space,
    argumentSplitter,
}

// Enum for container type, used for formatting and context
export enum SqlPrintTokenContainerType {
    ColumnReference = 'ColumnReference',
    LiteralValue = 'LiteralValue',
    IdentifierString = 'IdentifierString',
    InlineQuery = 'InlineQuery',
    StringSpecifierExpression = 'StringSpecifierExpression',
    None = '',
    ValueList = 'ValueList',
    OrderByItem = 'OrderByItem',
    FunctionCall = 'FunctionCall',
    UnaryExpression = 'UnaryExpression',
    BinaryExpression = 'BinaryExpression',
    SwitchCaseArgument = 'SwitchCaseArgument',
    ElseClause = 'ElseClause',
    CaseKeyValuePair = 'CaseKeyValuePair',
    ParenExpression = 'ParenExpression',
    CastExpression = 'CastExpression',
    CaseExpression = 'CaseExpression',
    ArrayExpression = 'ArrayExpression',
    BetweenExpression = 'BetweenExpression',
    TypeValue = 'TypeValue',
    TupleExpression = 'TupleExpression',
    WindowFrameExpression = 'WindowFrameExpression',
    SelectItem = 'SelectItem',
    SelectClause = 'SelectClause',
    DistinctOn = 'DistinctOn',
    SourceExpression = 'SourceExpression',
    FromClause = 'FromClause',
    JoinClause = 'JoinClause',
    JoinOnClause = 'JoinOnClause',
    JoinUsingClause = 'JoinUsingClause',
    FunctionSource = 'FunctionSource',
    SourceAliasExpression = 'SourceAliasExpression',
    RawString = 'RawString',
    QualifiedName = "QualifiedName",
    WhereClause = "WhereClause",
    SimpleSelectQuery = "SimpleSelectQuery",
    OrderByClause = "OrderByClause",
    GroupByClause = "GroupByClause",
    HavingClause = "HavingClause",
    SubQuerySource = "SubQuerySource",
    PartitionByClause = "PartitionByClause",
    WindowFrameClause = "WindowFrameClause",
    LimitClause = "LimitClause",
    OffsetClause = "OffsetClause",
    ForClause = "ForClause",
    WindowClause = "WindowClause",
    BinarySelectQueryOperator = "BinarySelectQueryOperator",
    Values = "Values",
    ValuesQuery = "ValuesQuery",
    WithClause = "WithClause",
    CommonTable = "CommonTable",
    WindowFrameSpec = "WindowFrameSpec",
    WindowFrameBoundStatic = "WindowFrameBoundStatic",
    WindowFrameBoundaryValue = "WindowFrameBoundaryValue",
    FetchClause = "FetchClause",
    FetchExpression = "FetchExpression",
    InsertQuery = "InsertQuery",
    UpdateQuery = "UpdateQuery",
    UpdateClause = "UpdateClause",
    ReturningClause = "ReturningClause",
    SetClauseItem = "SetClauseItem",
    CreateTableQuery = "CreateTableQuery",
    // Add more as needed
}

export class SqlPrintToken {
    /**
     * The type of this token, representing the general category (e.g. keyword, value, operator).
     */
    type: SqlPrintTokenType;
    /**
     * The actual text content of this token, following SQL syntax.
     */
    text: string;
    /**
     * The type of the container this token belongs to. Used for clauses, functions, or other groupings.
     */
    containerType: SqlPrintTokenContainerType;

    /**
     * Optional. Keywords that are part of this token, like DISTINCT in a SELECT clause.
     * These should typically be processed before innerTokens.
     */
    keywordTokens?: SqlPrintToken[];

    /**
     * Child tokens that belong to this container.
     */
    innerTokens: SqlPrintToken[] = [];

    constructor(type: SqlPrintTokenType, text: string = '', containerType: SqlPrintTokenContainerType = SqlPrintTokenContainerType.None) {
        this.type = type;
        this.text = text;
        this.containerType = containerType;
    }
}
