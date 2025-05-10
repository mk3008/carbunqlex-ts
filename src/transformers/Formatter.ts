import { SqlFormatter } from './SqlFormatter';
import { SelectQuery } from '../models/SelectQuery';
import { SqlComponent, SqlComponentVisitor } from '../models/SqlComponent';
import { FormatterConfig } from '../parsers/SqlPrintTokenParser';

export class Formatter implements SqlComponentVisitor<string> {
    private sqlFormatter: SqlFormatter;

    constructor() {
        this.sqlFormatter = new SqlFormatter({
            identifierEscape: { start: '"', end: '"' },
            parameterSymbol: ':',
            parameterStyle: 'named' // Default to 'named' for backward compatibility
        });
    }

    public format(arg: SqlComponent, config: FormatterConfig | null = null): string {
        // Use the sqlFormatter instance to format the SQL component
        if (config) {
            this.sqlFormatter = new SqlFormatter(config);
        }
        const result = this.sqlFormatter.format(arg);
        return result.formattedSql;
    }

    public formatWithParameters(arg: SqlComponent, config: FormatterConfig | null = null): { sql: string, params: any[] | Record<string, any>[] | Record<string, any> } {
        // Use the sqlFormatter instance to format the SQL component with parameters
        if (config) {
            this.sqlFormatter = new SqlFormatter(config);
        }
        const result = this.sqlFormatter.format(arg);
        return { sql: result.formattedSql, params: result.params };
    }

    public visit(arg: SqlComponent): string {
        return this.format(arg);
    }
}