/**
 * Common types used across multiple modules
 */

/**
 * Query execution metrics
 */
export interface QueryMetrics {
    /** Generated SQL queries */
    sqlQueries: string[];
    /** Actual parameters used in the query execution */
    actualParameters?: any;
}
