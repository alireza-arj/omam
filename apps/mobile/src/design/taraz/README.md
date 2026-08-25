# Taraz

The Omam design layer — a React Native port of the **Moview Design System**
(`claude.ai/design/p/0293bd87-59f8-4e0a-a728-6a619dca0b26`).

Cool white paper, blue-grey ink, one hot crimson. Content is the only thing
allowed to be loud; the interface is glass and hairlines.

## Rules

- **Nothing outside this folder names a colour, a type size, a radius or a
  duration.** Screens import components and `layout`/`motion` constants from
  `src/design/taraz`; if a value is missing, add it to `tokens.ts` rather than
  inlining it.
- **Crimson means *do something*.** Actions, active states, links, the running
  second hand. A selected filter is near-black, not crimson.
- **Semantics are for status only** — success / warning / info, never decoration.
- **Elevation carries its own hairline.** `shadow(level, colors)` returns border
  *and* drop together; never add a border to an elevated surface.
- **Glass means something is behind it.** `<Glass>` over scrolling content only,
  never a blur on a static background.
- **Motion**: fades and slides, one easing family, `scale(.97)` on press.
  Nothing bounces, rotates or pulses.
- **Copy**: sentence case everywhere, buttons are verbs, no emoji, runtimes as
  `1h 56m`, timecodes monospaced, metadata joined with a middot (`joinMeta`).

## Layout

| File | What |
|---|---|
| `tokens.ts` | Palette, light/dark schemes, spacing, radius, type roles, motion, elevation |
| `theme.tsx` | `ThemeProvider`, `useTheme()`, `useColors()` — follows the system colour scheme |
| `fonts.ts` | Figtree / Public Sans / IBM Plex Mono via `useTarazFonts()` |
| `components/` | Text, Icon, Button, IconButton, Card, Glass, Divider, Badge, Tag, Avatar, Input, SegmentedControl, ProgressBar, Skeleton, EmptyState, ListRow, Stat, Screen, PageHeader, TabBar |

## Flagged substitutions

The source system specifies **Heroicons**; this app already ships
`lucide-react-native`, so `Icon` wraps Lucide at a fixed 1.5px stroke on the 24px
grid — the closest match. Lucide has no solid variant, so the active tab item is
marked by crimson rather than by a filled glyph.

The source system ships **no logo** and sets the product name in Figtree 800 at
−4.5% tracking wherever a mark would go; `src/components/wordmark.tsx` does that.
Supply a real mark and it replaces the wordmark.
