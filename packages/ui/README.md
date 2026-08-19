# `@aigarth/ui`

Shared design system for Aigarth Cloud.

## What you get

- **Primitives** — `Button`, `Card`, `Dialog`, `Tabs`, etc. shadcn-style over Radix UI.
- **Composites** — bundles of primitives for common patterns (added as we need them).
- **Icons** — re-exported `lucide-react`.
- **Styles** — `globals.css` with all design tokens, both brand palettes, and component utilities.

## Usage in a Next.js app

```ts
// app/layout.tsx
import "@aigarth/ui/styles.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-brand="garden" className="dark">
      <body>{children}</body>
    </html>
  );
}
```

```ts
// anywhere in your app
import { Button, Card, CardHeader, CardTitle, CardContent } from "@aigarth/ui";
import { Sparkles } from "@aigarth/ui/icons";

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default" size="lg">
          <Sparkles className="size-4" />
          Click me
        </Button>
      </CardContent>
    </Card>
  );
}
```

## Tailwind

Use the shared Tailwind preset to inherit our colors, fonts, and animations:

```cjs
// tailwind.config.cjs
const preset = require("@aigarth/config/tailwind-preset");
module.exports = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // Important: include the package's source so its classes are emitted.
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};
```

## Brand switching

`data-brand` and `.dark` on `<html>` is all you need. The `ThemeSelector`
composite (lives in `apps/web/components/shared/theme-selector.tsx` for now,
will move here once stabilized) does this for you.
