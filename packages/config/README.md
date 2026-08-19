# `@aigarth/config`

Shared configuration for the Aigarth monorepo. Pure config, no source.

## TSConfig presets

- `@aigarth/config/tsconfig/base` — base strict TypeScript config
- `@aigarth/config/tsconfig/library` — for shared packages (declaration, source maps)
- `@aigarth/config/tsconfig/nextjs` — for Next.js apps (jsx, next plugin)
- `@aigarth/config/tsconfig/node` — for backend services

Usage:

```jsonc
// apps/web/tsconfig.json
{
  "extends": "@aigarth/config/tsconfig/nextjs",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

## ESLint

```cjs
// .eslintrc.cjs
module.exports = require("@aigarth/config/eslint");
```

For Next.js apps:

```cjs
module.exports = require("@aigarth/config/eslint/next");
```

## Prettier

```cjs
// .prettierrc.cjs
module.exports = require("@aigarth/config/prettier");
```
