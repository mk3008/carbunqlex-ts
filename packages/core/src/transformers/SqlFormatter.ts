import { SqlPrintTokenParser, FormatterConfig, PRESETS } from '../parsers/SqlPrintTokenParser';
import { SqlPrinter, CommaBreakStyle, AndBreakStyle } from './SqlPrinter';
import { IndentCharOption, NewlineOption } from './LinePrinter'; // Import types for compatibility
import { SelectQuery } from '../models/SelectQuery';
import { SqlComponent } from '../models/SqlComponent';

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
        this.printer = new SqlPrinter(options);
    }    /**
     * Formats a SQL query string with the given parameters.
     * @param sqlText The SQL query string to format.
     * @param parameters A dictionary of parameters to replace in the query.
     * @returns An object containing the formatted SQL string and the parameters.
     */
    format(sql: SqlComponent): { formattedSql: string; params: any[] | Record<string, any> } {
        const { token, params } = this.parser.parse(sql);
        const formattedSql = this.printer.print(token);

        return { formattedSql, params };
    }
}
