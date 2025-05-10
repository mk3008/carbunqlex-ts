import * as Benchmark from 'benchmark';
import * as os from 'os';
import { Formatter } from '../src/transformers/Formatter';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { format as sqlFormat } from 'sql-formatter';
import { Parser as NodeSqlParser } from 'node-sql-parser';
import { parse as cstParse } from 'sql-parser-cst';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

// Set of SQL queries for benchmarking
const queries = [
    {
        name: 'Tokens20',
        sql: `SELECT id, name, email, age, created_at, updated_at, status, role, last_login, country
              FROM users
              WHERE id = 1;`
    },
    {
        name: 'Tokens70',
        sql: `SELECT
                u.id, u.name, u.email, u.age, u.status, u.role,
                o.id AS order_id, o.total, o.order_date, o.status AS order_status
              FROM users AS u
              JOIN orders AS o ON u.id = o.user_id
              WHERE u.age > 1 AND o.status = 'completed'
              ORDER BY o.order_date DESC;`
    },
    {
        name: 'Tokens140',
        sql: `WITH recent_orders AS (
                SELECT user_id, MAX(order_date) AS last_order
                FROM orders
                GROUP BY user_id
              )
              SELECT
                u.id, u.name, u.email, u.age, u.status, u.role, u.created_at, u.updated_at,
                r.last_order, SUM(o.total) AS total_spent
              FROM users AS u
              JOIN orders AS o ON u.id = o.user_id
              JOIN recent_orders AS r ON u.id = r.user_id
              WHERE u.status = 'active'
              GROUP BY u.id, u.name, u.email, u.age, u.status, u.role, u.created_at, u.updated_at, r.last_order
              HAVING SUM(o.total) > 10
              ORDER BY total_spent DESC;`
    },
    {
        name: 'Tokens230',
        sql: `with
                detail as (
                    select
                        q.*,
                        trunc(q.price * (1 + q.tax_rate)) - q.price as tax,
                        q.price * (1 + q.tax_rate) - q.price as raw_tax
                    from
                        (
                            select
                                dat.*,
                                (dat.unit_price * dat.quantity) as price
                            from
                                dat
                        ) q
                ),
                tax_summary as (
                    select
                        d.tax_rate,
                        trunc(sum(raw_tax)) as total_tax
                    from
                        detail d
                    group by
                        d.tax_rate
                )
                select
                line_id,
                    name,
                    unit_price,
                    quantity,
                    tax_rate,
                    price,
                    price + tax as tax_included_price,
                    tax
                from
                    (
                        select
                            line_id,
                            name,
                            unit_price,
                            quantity,
                            tax_rate,
                            price,
                            tax + adjust_tax as tax
                        from
                            (
                                select
                                    q.*,
                                    case when q.total_tax - q.cumulative >= q.priority then 1 else 0 end as adjust_tax
                                from
                                    (
                                        select
                                            d.*,
                                            s.total_tax,
                                            sum(d.tax) over (partition by d.tax_rate) as cumulative,
                                            row_number() over (partition by d.tax_rate order by d.raw_tax % 1 desc, d.line_id) as priority
                                        from
                                            detail d
                                            inner join tax_summary s on d.tax_rate = s.tax_rate
                                    ) q
                            ) q
                    ) q
                order by
                    line_id`
    }
];

// Create formatter instance (use if needed)
const formatter = new Formatter();
const sqlFormatter = new SqlFormatter();

const nodeSqlParser = new NodeSqlParser();

// Create benchmark suite
const suite = new Benchmark.Suite;

function formatWithRawSql(sql: string) {
    return () => {
        const query = SelectQueryParser.parse(sql);
        query.accept(formatter);
    };
}

function formatWithRawSql_SqlFormatter(sql: string) {
    return () => {
        const query = SelectQueryParser.parse(sql);
        sqlFormatter.format(query);
    };
}

function formatWithSqlFormatter(sql: string) {
    return () => {
        sqlFormat(sql, { language: 'postgresql' });
    };
}

function formatWithNodeSqlParser(sql: string) {
    return () => {
        const ast = nodeSqlParser.astify(sql);
        nodeSqlParser.sqlify(ast);
    };
}

function formatWithSqlParserCst(sql: string) {
    return () => {
        cstParse(sql, { dialect: 'postgresql' });
    };
}

// Get system information
function getSystemInfo() {
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown CPU';
    const cpuCount = cpus.length;
    const logicalCores = cpuCount;
    const osName = `${os.type()} ${os.release()}`;
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const nodeVersion = process.version;

    return {
        cpuModel,
        logicalCores,
        osName,
        totalMem,
        nodeVersion
    };
}

// Add benchmarks for individual queries
queries.forEach((query, index) => {
    // Set label using query name
    suite.add(`rawsql-ts ${query.name}`, formatWithRawSql(query.sql));
    // Set label using query name
    suite.add(`rawsql-ts[styled] ${query.name}`, formatWithRawSql_SqlFormatter(query.sql));
    // Add node-sql-parser benchmark for comparison
    suite.add(`node-sql-parser ${query.name}`, formatWithNodeSqlParser(query.sql));
    // Add sql-parser-cst benchmark for comparison
    suite.add(`sql-parser-cst ${query.name}`, formatWithSqlParserCst(query.sql));
    // Add sql-formatter benchmark for comparison
    suite.add(`sql-formatter ${query.name}`, formatWithSqlFormatter(query.sql));
});

// Function to display header and system information
function printHeader() {
    const info = getSystemInfo();
    const currentDate = new Date().toISOString().split('T')[0];
    // Get benchmark version information
    const benchmarkVersion = require('benchmark/package.json').version;

    console.log('```');
    console.log(`benchmark.js v${benchmarkVersion}, ${info.osName}`);
    console.log(`${info.cpuModel.trim()}, ${info.logicalCores} logical cores`);
    console.log(`Node.js ${info.nodeVersion}`);
    console.log('```');
    console.log('');
}

// Display report in markdown table format - grouped by token size
function printResults(results: any[]) {
    // Group results by token size (based on query name)
    const queryNames = queries.map(q => q.name);
    const groupedResults: Record<string, any[]> = {};

    queryNames.forEach(name => {
        groupedResults[name] = results.filter(r => r.name.includes(name));
    });

    // Print a table for each token group
    Object.keys(groupedResults).forEach(groupName => {
        console.log(`\n### ${groupName}`);
        // Add new column header for rawsql-ts comparison
        console.log('| Method                            | Mean       | Error     | StdDev    | Times slower vs rawsql-ts |');
        console.log('|---------------------------------- |-----------:|----------:|----------:|--------------------------:|');

        const groupResults = groupedResults[groupName];

        // Find the mean value for rawsql-ts in this group
        const rawsqlResult = groupResults.find(r => r.name.startsWith('rawsql-ts'));
        const rawsqlMean = rawsqlResult ? rawsqlResult.mean : null;

        // Display in original order (don't sort by time)
        groupResults.forEach(result => {
            // Format method name (extract library name)
            const methodMatch = result.name.match(/^([^]+)\s+Tokens\d+$/);
            const methodName = methodMatch ? methodMatch[1] : result.name;
            const name = methodName.padEnd(30).substring(0, 30);

            // Display average time in milliseconds (3 decimal places)
            const mean = (result.mean * 1000).toFixed(3).padStart(8);

            // Display error rate in milliseconds (4 decimal places)
            const error = ((result.stats.deviation * 1000) * 1.96).toFixed(4).padStart(7);

            // Display standard deviation in milliseconds (4 decimal places)
            const stddev = (result.stats.deviation * 1000).toFixed(4).padStart(7);

            // Calculate ratio vs rawsql-ts (how many times slower)
            let ratioStr = '-';
            if (rawsqlMean && !result.name.startsWith('rawsql-ts')) {
                const ratio = result.mean / rawsqlMean;
                if (ratio >= 1.01) {
                    ratioStr = ratio.toFixed(1) + 'x';
                } else {
                    ratioStr = '<1x';
                }
            }

            console.log(`| ${name} | ${mean} ms | ${error} ms | ${stddev} ms | ${ratioStr.padStart(16)} |`);
        });
    });

    console.log('')
}

// Callback when benchmark is completed
suite.on('cycle', (event: any) => {
    // Suppress log output for each cycle
});

// Callback on completion
suite.on('complete', function (this: any) {
    // Get results as an array
    const results = this.filter('successful').map((benchmark: any) => ({
        name: benchmark.name,
        hz: benchmark.hz,
        stats: benchmark.stats,
        rme: benchmark.stats.rme,
        mean: benchmark.stats.mean,
        samples: benchmark.stats.sample.length
    }));

    // No longer sorting results
    // Display header and system information
    printHeader();

    // Display results grouped by token size
    printResults(results);
});

// Run benchmark
console.log('running...');
suite.run({ 'async': false });