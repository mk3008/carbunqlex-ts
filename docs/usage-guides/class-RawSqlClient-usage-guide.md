# RawSqlClient Usage Guide

## Overview

`RawSqlClient` is the main interface for executing SQL queries with auto-serialization support in the `@msugiura/rawsql-prisma` package. It provides a simple, type-safe way to execute file-based SQL queries and transform results into structured JSON objects.

## Core Methods

The `RawSqlClient` provides **two main public methods** for executing SQL queries:

| Method | JSON Mapping | Return Type | Best For |
|--------|-------------|-------------|----------|
| `queryOne()` | **Required** | `T` or `null` | Single result endpoints |
| `queryMany()` | **Required** | `T[]` | Multiple results endpoints |

> **Note:** The `query()` method has been made private as of v0.1.0-alpha to simplify the API and reduce confusion. Use `queryOne()` or `queryMany()` instead for clearer intent and better type safety.

### `queryOne<T>(sqlPath, options?)`

**High-level method** that always requires JSON mapping and returns a single result or null.

```typescript
const user = await client.queryOne<User>('users/get-profile.sql', { 
  filter: { userId: 123 } 
});
// Returns: User | null
// Throws: JsonMappingRequiredError if users/get-profile.json is missing
```

**When to use:**
- ✅ For `GET /users/:id` type endpoints
- ✅ When you expect exactly one result or null
- ✅ When you always want structured JSON objects
- ✅ When JSON mapping should be mandatory (enforced)

### `queryMany<T>(sqlPath, options?)`

**High-level method** that always requires JSON mapping and returns an array of results.

```typescript
const todos = await client.queryMany<Todo>('todos/search.sql', { 
  filter: { status: 'pending' } 
});
// Returns: Todo[]
// Throws: JsonMappingRequiredError if todos/search.json is missing
```

**When to use:**
- ✅ For `GET /users` type endpoints
- ✅ When you expect multiple results (even if potentially empty)
- ✅ When you always want structured JSON arrays
- ✅ When JSON mapping should be mandatory (enforced)

### Decision Flow

```mermaid
graph TD
    A[Need to execute SQL?] --> B{Single result or multiple?}
    B -->|Single| C[Use queryOne&lt;T&gt;]
    B -->|Multiple| D[Use queryMany&lt;T&gt;]
    
    C --> E[Requires JSON mapping file]
    D --> F[Requires JSON mapping file]
    
    E --> G[Returns T | null]
    F --> H[Returns T[]]
```

### Why was `query()` removed?

The `query()` method was made private in v0.1.0-alpha for the following reasons:

1. **🔀 Confusing behavior**: Too many options (`serialize: true/false/undefined`) led to unpredictable results
2. **📱 Unclear return types**: Return type varied (`T[]` | `T` | `null`) depending on options, making TypeScript integration difficult
3. **🤔 Inconsistent JSON mapping**: Auto-detection vs explicit serialization caused confusion
4. **🎯 Better alternatives**: `queryOne()` and `queryMany()` provide clearer intent and safer defaults

**Migration guide:**
```typescript
// ❌ Old way (removed)
const result = await client.query('users/list.sql');

// ✅ New way - clear intent
const users = await client.queryMany<User>('users/list.sql');  // For multiple results
const user = await client.queryOne<User>('users/get-by-id.sql'); // For single result
```

## JSON Mapping and Auto-Serialization

### How It Works

When you call `queryOne<T>()` or `queryMany<T>()`, the client automatically looks for a `.json` mapping file alongside your `.sql` file:

```
sql/
  users/
    get-profile.sql     ← SQL query
    get-profile.json    ← JSON mapping (auto-loaded)
```

### JSON Mapping Structure

The JSON mapping file defines how flat SQL results should be transformed into hierarchical JSON structures:

```json
{
  "user": {
    "id": "user_id",
    "name": "user_name",
    "email": "user_email"
  },
  "posts": [
    {
      "id": "post_id",
      "title": "post_title",
      "content": "post_content",
      "createdAt": "post_created_at"
    }
  ]
}
```

### SQL Query Example

```sql
-- users/get-profile.sql
SELECT 
  u.id as user_id,
  u.name as user_name,
  u.email as user_email,
  p.id as post_id,
  p.title as post_title,
  p.content as post_content,
  p.created_at as post_created_at
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.id = :userId
```

### TypeScript Usage

```typescript
interface UserProfile {
  user: {
    id: number;
    name: string;
    email: string;
  };
  posts: Array<{
    id: number;
    title: string;
    content: string;
    createdAt: string;
  }>;
}

const profile = await client.queryOne<UserProfile>('users/get-profile.sql', { 
  filter: { userId: 123 } 
});
```

## Advanced Features

### Conditional Serialization

For the `query<T>()` method, serialization is controlled by options:

```typescript
// Auto-detect: enables serialization if .json file exists
const result1 = await client.query<User>('users/get-profile.sql', { 
  filter: { userId: 123 } 
});

// Force enable serialization
const result2 = await client.query<User>('users/get-profile.sql', 
  { filter: { userId: 123 } }, 
  { serialize: true }
);

// Force disable serialization
const result3 = await client.query<any[]>('users/get-profile.sql', 
  { filter: { userId: 123 } }, 
  { serialize: false }
);
```

### Error Handling

The `queryOne<T>()` and `queryMany<T>()` methods require JSON mapping files and will throw clear errors when they're missing:

```typescript
import { JsonMappingRequiredError } from '@msugiura/rawsql-prisma';

try {
  const user = await client.queryOne<User>('users/get-profile.sql', { 
    filter: { userId: 123 } 
  });
  if (!user) {
    console.log('User not found');
  }
} catch (error) {
  if (error instanceof JsonMappingRequiredError) {
    console.error('Missing JSON mapping file:', error.expectedMappingPath);
    console.error('For SQL file:', error.sqlFilePath);
    // The error message contains helpful solutions:
    // 1. Create the JSON mapping file
    // 2. Use query() method instead if you want raw results
  } else {
    console.error('Query failed:', error);
  }
}
```

#### Error Types

- **`JsonMappingRequiredError`**: Thrown when `queryOne()` or `queryMany()` cannot find the required JSON mapping file
- **`SqlFileNotFoundError`**: Thrown when the SQL file cannot be found
- **`JsonMappingError`**: Thrown when the JSON mapping file is invalid
- **`SqlExecutionError`**: Thrown when SQL execution fails

#### When JSON Mapping is Required vs Optional

```typescript
// ❌ REQUIRES JSON mapping file - will throw if missing
const users = await client.queryOne<User>('users/get-profile.sql');
const usersList = await client.queryMany<User>('users/list.sql');

// ✅ JSON mapping is OPTIONAL - works with or without
const rawResult = await client.query('users/get-profile.sql'); // Raw database rows
const serializedResult = await client.query('users/get-profile.sql', {}, { serialize: true }); // Auto-detects mapping
```

## Best Practices

### 1. Use Descriptive File Names

```
sql/
  users/
    get-profile.sql          ← Clear purpose
    search-by-department.sql ← Descriptive action
  orders/
    get-recent-orders.sql    ← Specific scope
```

### 2. Structure Your Mapping Files

Keep your JSON mappings simple and focused:

```json
{
  "order": {
    "id": "order_id",
    "total": "order_total",
    "status": "order_status"
  },
  "items": [
    {
      "id": "item_id",
      "name": "item_name",
      "quantity": "item_quantity",
      "price": "item_price"
    }
  ],
  "customer": {
    "id": "customer_id",
    "name": "customer_name"
  }
}
```

### 3. Prefer `queryOne` and `queryMany`

These methods provide clearer intent and automatic serialization:

```typescript
// ✅ Clear intent: expecting single result
const user = await client.queryOne<User>('users/get-by-id.sql', { id: 123 });

// ✅ Clear intent: expecting multiple results
const users = await client.queryMany<User>('users/search.sql', { department: 'IT' });

// ❌ Less clear: what type of result do we expect?
const result = await client.query<User>('users/get-by-id.sql', { id: 123 });
```

## Integration Examples

### With Existing Prisma Code

```typescript
// Traditional Prisma
const userPrisma = await prisma.user.findUnique({
  where: { id: userId },
  include: { posts: true, comments: true }
});

// RawSqlClient for complex queries
const userAnalytics = await client.queryOne<UserAnalytics>(
  'analytics/user-engagement.sql', 
  { userId, dateRange: '30d' }
);
```

### In API Routes (Next.js)

```typescript
// pages/api/users/[id]/profile.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  const profile = await client.queryOne<UserProfile>('users/get-profile.sql', { 
    userId: parseInt(id as string) 
  });
  
  if (!profile) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(profile);
}
```

## Troubleshooting

### JSON Mapping Not Working

1. Ensure the `.json` file is in the same directory as the `.sql` file
2. Check that the JSON structure matches your TypeScript interface
3. Verify that SQL column aliases match the mapping keys

### Type Safety Issues

1. Use explicit TypeScript interfaces for your result types
2. Ensure your SQL column aliases are consistent with your JSON mapping
3. Test your queries with unit tests to catch type mismatches early

## Related Guides

- [SQL File Organization Guide](./sql-file-organization-guide.md)
- [TypeScript Integration Guide](./typescript-integration-guide.md)
- [SQL Schema Validator Guide](./class-SqlSchemaValidator-usage-guide.md)
