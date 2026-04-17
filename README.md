# Proto-Lab Design System — Token Library

Design tokens extracted from the [Proto-Lab Design System](https://www.figma.com/design/ADyu4GaQPThxZXCkuABH98/Proto-Lab-Design-System) Figma file.

**Foundation:** CapTech Brand identity layered on Microsoft Fluent 2 Web, with light and dark mode support.

## Structure

```
tokens/
├── color/
│   ├── primitives.json       # Raw color palette (brand, neutral, accent, ramp)
│   ├── semantic-light.json   # Light mode semantic tokens (references primitives)
│   └── semantic-dark.json    # Dark mode semantic tokens
├── typography.json            # Font family, weights, and type scale
├── layout.json                # Spacing, corner radius, stroke width, shadows
└── css/
    └── variables-light.css   # Ready-to-use CSS custom properties (light mode)
```

## Token Format

JSON files follow the [Design Tokens Community Group](https://tr.designtokens.org/format/) spec:

```json
{
  "color-name": {
    "$value": "#005eb8",
    "$type": "color",
    "$description": "CapTech Blue — primary brand color"
  }
}
```

Semantic tokens use `{references}` to point back to primitives, keeping the system maintainable.

## Quick Start — CSS

Drop in the CSS file for immediate use:

```html
<link rel="stylesheet" href="tokens/css/variables-light.css">
```

Then use variables in your styles:

```css
.card {
  background: var(--neutral-background-2);
  border: var(--stroke-thin) solid var(--neutral-stroke-1);
  border-radius: var(--radius-large);
  padding: var(--spacing-l);
  box-shadow: var(--shadow-4);
  font-family: var(--font-family);
  color: var(--neutral-foreground-1);
}

.button-primary {
  background: var(--brand-background-1);
  color: var(--neutral-foreground-on-brand);
  border-radius: var(--radius-medium);
  padding: var(--spacing-xs) var(--spacing-m);
}
```

## Key Design Decisions

| Decision | Detail |
|---|---|
| **Primary font** | Gibson (falls back to Source Sans Pro) |
| **Brand color** | CapTech Blue `#005eb8` (Brand-80 in ramp) |
| **Brand accent** | Yellow `#fdda24` (same in light & dark) |
| **Spacing scale** | Fluent 2 — 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32 |
| **Corner radius** | Fluent 2 — 0, 2, 4, 6, 8, 9999 |
| **Elevation** | 6 levels (2, 4, 8, 16, 28, 64) using ambient + key shadows |

## Figma Source

- **File key:** `ADyu4GaQPThxZXCkuABH98`
- **Variable collections:** Primitive Colors, Semantic Tokens (Light/Dark), Layout, Brand Ramp
- **Components:** Switch, Teaching Popover, Icons, and 40+ inherited from Fluent 2 Web
