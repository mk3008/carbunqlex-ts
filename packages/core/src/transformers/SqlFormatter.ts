import { SqlPrintTokenParser, FormatterConfig, PRESETS } from '../parsers/SqlPrintTokenParser';
import { SqlPrinter, CommaBreakStyle, AndBreakStyle } from './SqlPrinter';
import { IndentCharOption, NewlineOption } from './LinePrinter'; // Import types for compatibility
import { SelectQuery } from '../models/SelectQuery';
import { SqlComponent } from '../models/SqlComponent';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { CTEDependencyTracer } from './CTEDependencyTracer';

// Define valid preset names as a union type
export const VALID_PRESETS = ['mysql', 'postgres', 'sqlserver', 'sqlite'] as const;
export type PresetName = (typeof VALID_PRESETS)[number];

/**
 * SqlFormatter class combines parsing and printing of SQL queries into a single interface.
 */
export class SqlFormatter {
    private parser: SqlPrintTokenParser;
    private printer: SqlPrinter;

    constructor(options: {
        preset?: PresetName; // Restrict preset to specific strings
        identifierEscape?: { start: string; end: string }; // Allow custom identifier escape
        parameterSymbol?: string | { start: string; end: string }; // Allow custom parameter symbol
        parameterStyle?: 'anonymous' | 'indexed' | 'named'; // Allow custom parameter style
        indentSize?: number;
        indentChar?: IndentCharOption; // Updated type
        newline?: NewlineOption; // Updated type
        keywordCase?: 'none' | 'upper' | 'lower'; // Updated type
        commaBreak?: CommaBreakStyle; // Updated type
        andBreak?: AndBreakStyle; // Updated type
        exportComment?: boolean; // Add comment export option
        strictCommentPlacement?: boolean; // Only export comments from clause-level keywords
        cteOneline?: boolean; // Format CTE parts as one-liners
        cteOnelineDependency?: boolean; // Format CTE parts as one-liners based on dependencies
    } = {}) { // Default to 'sqlserver' if options is empty

        const presetConfig = options.preset ? PRESETS[options.preset] : undefined;

        if (options.preset && !presetConfig) {
            throw new Error(`Invalid preset: ${options.preset}`); // Throw error for invalid preset
        }

        const parserOptions = {
            ...presetConfig, // Apply preset configuration
            identifierEscape: options.identifierEscape ?? presetConfig?.identifierEscape,
            parameterSymbol: options.parameterSymbol ?? presetConfig?.parameterSymbol,
            parameterStyle: options.parameterStyle ?? presetConfig?.parameterStyle,
        };

        this.parser = new SqlPrintTokenParser(parserOptions);
        
        // Calculate CTE oneline set if dependency-based formatting is enabled
        let cteOnelineSet: Set<string> | undefined;
        if (options.cteOnelineDependency) {
            // This will be computed per-query in the format method
            cteOnelineSet = new Set();
        }
        
        this.printer = new SqlPrinter({ ...options, cteOnelineSet });
    }    /**
     * Formats a SQL query string with the given parameters.
     * @param sqlText The SQL query string to format.
     * @param parameters A dictionary of parameters to replace in the query.
     * @returns An object containing the formatted SQL string and the parameters.
     */
    format(sql: SqlComponent): { formattedSql: string; params: any[] | Record<string, any> } {
        const { token, params } = this.parser.parse(sql);
        
        // If dependency-based CTE formatting is enabled, analyze the query
        if (this.printer.cteOnelineDependency && sql instanceof SimpleSelectQuery) {
            const directlyReferencedCtes = this.findDirectlyReferencedCtes(sql);
            const importComments = this.generateImportComments(directlyReferencedCtes);
            
            // Enable oneline for all CTEs and add import comments
            this.printer['cteOneline'] = true;
            this.printer['importComments'] = importComments;
        }
        
        const formattedSql = this.printer.print(token);

        return { formattedSql, params };
    }

    /**
     * Finds CTEs that are directly referenced by the main query
     * @param query The parsed SQL query
     * @returns Array of CTE names directly referenced by main query
     */
    private findDirectlyReferencedCtes(query: SimpleSelectQuery): string[] {
        const directlyReferenced: string[] = [];
        
        try {
            // Use CTEDependencyTracer to analyze the query structure
            const tracer = new CTEDependencyTracer({ silent: true });
            const graph = tracer.buildGraph(query);
            
            // Find CTEs that are referenced by the main query
            // These are typically the leaf nodes in the dependency graph
            // or CTEs that are directly used in the final SELECT
            for (const cteName of graph.leafNodes) {
                directlyReferenced.push(cteName);
            }
            
        } catch (error) {
            // Silently fall back to no dependency analysis if CTEDependencyTracer fails
            // This ensures the feature degrades gracefully
        }
        
        return directlyReferenced;
    }

    /**
     * Generates import comments for directly referenced CTEs
     * @param cteNames Array of CTE names
     * @returns Array of import comment strings
     */
    private generateImportComments(cteNames: string[]): string[] {
        const CTE_FILE_EXTENSION = '.cte.sql';
        return cteNames.map(cteName => `/* import ${cteName}${CTE_FILE_EXTENSION} */`);
    }
}
