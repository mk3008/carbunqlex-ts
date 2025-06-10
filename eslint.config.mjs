import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
    {
        ignores: ["node_modules", "dist", "packages/*/node_modules", "packages/*/dist"] // Exclude folders
    },
    {
        files: ["packages/*/src/**/*.ts", "packages/*/tests/**/*.ts"], // Target package files
        languageOptions: {
            parser: typescriptParser,
            ecmaVersion: 2022,
            sourceType: 'module'
        },
        plugins: {
            "@typescript-eslint": typescriptEslint
        },
        rules: {
            // Naming convention constraints
            "@typescript-eslint/naming-convention": [
                "error",
                // Class names must be in PascalCase
                {
                    "selector": "class",
                    "format": ["PascalCase"]
                },
                // Function names must be in camelCase
                {
                    "selector": "function",
                    "format": ["camelCase"]
                },
                // Method names must be in camelCase
                {
                    "selector": "method",
                    "format": ["camelCase"]
                }
            ]
        },
    },
];
