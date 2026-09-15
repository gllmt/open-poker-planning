# UI lint rules

`pnpm lint` runs Oxlint on the repository; `pnpm lint:ui` uses the same
configuration on `app/` and `components/`. `pnpm lints` adds the Oxfmt and
TypeScript checks. These commands run in CI through the existing workflow.

## Oxlint

The correctness rules for TypeScript, React, Next.js and accessibility are
errors. The rules previously disabled during migration are now enabled,
including hook state updates, render purity and semantic HTML preferences.
`oxlint-tsgolint` provides type-aware checks, with unhandled and misused
promises explicitly reported as errors. `any` and unused variables remain
warnings.

Async game command props retain their `Promise<void>` return type until a
handler awaits them and handles failures. DOM event handlers return void;
create/join/remove handlers already catch and display their errors.

## Shadcn

All six rules are enabled as errors:

- `no-restyle`: consumers use component variants and allowed contracts.
- `no-raw-colors`: colors come from the theme in `app/globals.css`.
- `no-arbitrary-values`: appearance values come from tokens or utilities;
  layout values remain allowed (for example a card width or position).
- `no-inline-styles`: dynamic values use CSS custom properties consumed by
  classes; static values use classes.
- `no-unknown-classes`: class names must resolve in the Tailwind theme.
- `require-static-classes`: component classes must be statically readable.

The primitives in `components/ui/` and the custom `PlanningCard` own their
appearance. Following the upstream component-directory guidance, only
`no-restyle`, `no-arbitrary-values` and `require-static-classes` are disabled
inside those implementations. Color, inline-style and class-existence checks
still apply there. Callers remain subject to the normal rules.

### Component contracts

Contracts in `.oxlintrc.json` permit the following existing design choices:

| Component | Caller may control, in addition to layout |
| --- | --- |
| Card | `glass-card` and `dark-glass-card` surfaces |
| CardTitle | Typography, including truncation |
| FieldGroup | Spacing between fields |
| Skeleton | Border radius to match the placeholder's content |
| AvatarFallback | Theme colors |
| Label | Typography and theme colors |
| Button | Muted/destructive text, foreground/destructive hover text, and `hover:shadow-md` |

Button padding, background, borders and other appearance changes still need
an appropriate variant. Input exposes `default`, `timer` and `compact`
variants; consumers should use those instead of repeating their styles.

### Intentional exceptions

Local `oxlint-disable-next-line` comments explain five specific cases:

- Resetting the results flip animation before its next animation frame.
- Clearing confetti when the Convex subscription changes rounds.
- Invalidating the timer draft and pending write together on a remote start.
- Reading the clock inside the timer's click callback: Oxlint currently
  mistakes the custom `callback` prop for a render-time invocation.
- Using `role="img"` for a composite CSS card, which has no image resource.

These preserve existing behavior; the corresponding rules remain enabled
elsewhere. Do not replace these narrow exceptions with file-wide disables.

`@shadcn/lint` 0.1.0 mistakes custom `text-*` and `shadow-*` theme tokens for
color names. `no-raw-colors.allow` lists only the eight affected typography
and shadow classes defined in `app/globals.css`. It does not allow raw color
palettes or arbitrary class patterns. Revisit these entries after upgrading
the plugin.

References: [shadcn rule options](https://github.com/shadcn-ui/lint/blob/main/docs/rules.md),
[adoption guidance](https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md),
[Oxlint type-aware checks](https://oxc.rs/docs/guide/usage/linter/type-aware).
