# Design Review Results: Home Page (`/fr`)

**Review Date**: 2026-03-07
**Route**: `/fr` (Home) and `/fr/game/:id` (Game — partially reviewed, auth-gated)
**Focus Areas**: Visual Design, UX/Usability, Micro-interactions/Motion, Performance
**Benchmark**: Apple-inspired minimal aesthetic, glass design, smooth animations, keep orange accent

---

## Summary

The Planning Poker home page has a solid functional foundation — clean layout, good dark mode support, and decent responsive behavior. However, it falls short of the Apple-inspired glass aesthetic target: the page lacks depth, hierarchy, and polish. Feature cards are flat and undifferentiated, animations are limited to a single fade-in, and interactive feedback (hover/focus/press states) is minimal. The orange accent is well-chosen but under-utilized as a design language. With targeted improvements to visual layering, micro-interactions, and content hierarchy, this can become a much more premium experience.

---

## Issues

| # | Issue | Criticality | Category | Location |
|---|-------|-------------|----------|----------|
| 1 | **Feature cards lack visual hierarchy and differentiation** — The 4 feature items (`li` elements) are plain bordered boxes with no icons, illustrations, or visual cues. They look like placeholder wireframes rather than polished marketing content. An Apple-inspired design would use subtle gradients, iconography, or hover-activated depth effects. | 🟠 High | Visual Design | `app/[lang]/page.tsx:32-41` |
| 2 | **No glass/frosted-glass aesthetic on cards** — The create-session and recent-games cards use a flat white/dark background. To achieve the requested glass design, cards should use `backdrop-blur`, semi-transparent backgrounds (`bg-white/60 dark:bg-white/5`), and subtle border luminance to create a frosted glass effect. | 🟠 High | Visual Design | `components/poker/create-game.tsx:205`, `components/poker/recent-games.tsx:17,31` |
| 3 | **Orange border/glow effect on page edges is distracting** — There's a strong orange gradient effect on the left and right edges of the viewport (visible in both light and dark mode). This competes for attention with the content and feels heavy rather than minimal. Consider making it much subtler or replacing with a single subtle radial glow behind the hero section. | 🟠 High | Visual Design | `app/globals.css` or parent layout styles |
| 4 | **Hero section lacks visual weight and breathing room** — The eyebrow text, h1, and subtitle are tightly stacked with minimal vertical spacing (`mt-3`, `mt-4`). The h1 at `36px/40px` feels undersized for a hero. Apple-style heroes use generous padding (80-120px top), larger display fonts (48-64px), and subtle text animations on entry. | 🟡 Medium | Visual Design | `app/[lang]/page.tsx:20-29` |
| 5 | **No hover/active states on feature cards** — Feature list items have no `hover:` transitions. Apple-style cards typically have subtle scale transforms (`hover:scale-[1.02]`), shadow elevation changes, or background brightness shifts on hover to signal interactivity or emphasize content. | 🟠 High | Micro-interactions | `app/[lang]/page.tsx:34-38` |
| 6 | **Only one animation on the entire page** — `fade-in-down` (1s) on the HomePage container is the sole animation. The hero text, feature cards, and form sections all appear instantly. Apple pages stagger entry animations per element using intersection observers or scroll-triggered reveals. | 🟠 High | Micro-interactions | `components/poker/home-page.tsx:13`, `app/globals.css:146-155` |
| 7 | **CTA button ("Créer") lacks hover depth and press feedback** — The orange button uses `hover:bg-primary/90` which is a barely perceptible opacity change. It should have a more pronounced hover state (shadow elevation, slight scale) and an active/press state (`active:scale-[0.97]`) for tactile feedback. | 🟡 Medium | Micro-interactions | `components/ui/button.tsx:11` |
| 8 | **Radio buttons and checkbox are custom-built without transitions** — The radio/checkbox implementations in `create-game.tsx` use `peer-checked` opacity transitions, but the dot appearance is abrupt. These should have smooth scale-in animations (e.g., `transition: transform 150ms ease, opacity 150ms ease`) for a polished feel. | 🟡 Medium | Micro-interactions | `components/poker/create-game.tsx:261-274, 304-315` |
| 9 | **Nav links have no active/current route indicator** — "Nouveau" and "Rejoindre" links use `text-muted-foreground` with hover states, but there's no visual indicator for the currently active route. Apple-style navigation uses subtle underlines, dot indicators, or font weight changes on the active item. | 🟡 Medium | UX/Usability | `components/toolbar/toolbar.tsx:23-34` |
| 10 | **Recent games table lacks hover row highlighting animation** — Table rows have `hover:bg-muted/60` but the transition feels flat. Rows should have a smooth background color transition with a subtle left-border accent or scale effect to indicate clickability more clearly. Also, the `cursor-pointer` is applied but without visual feedback the clickable nature is non-obvious. | 🟡 Medium | UX/Usability | `components/poker/recent-games.tsx:50-55` |
| 11 | **Missing loading skeleton/shimmer for "Sessions recentes"** — The `RecentGames` component is dynamically imported with `ssr: false` but the fallback only shows a generic `<Loading />` spinner. Apple-style loading uses skeleton placeholders that match the final content shape, providing a smoother perceived performance. | 🟡 Medium | UX/Usability | `components/poker/home-page.tsx:6-9` |
| 12 | **Form section title ("Créer une nouvelle session") alignment inconsistency** — The card title is centered (`text-center`) but form labels are left-aligned. This creates a subtle visual tension. Either commit to center-aligned or left-aligned consistently. | ⚪ Low | Visual Design | `components/poker/create-game.tsx:206-207` |
| 13 | **Footer is minimal to the point of feeling incomplete** — Just a single "GitHub" link in `text-xs`. While minimal is good, this feels unfinished. Consider adding the project name, a subtle separator, and perhaps a language toggle or theme preference note. | ⚪ Low | Visual Design | `app/[lang]/page.tsx:55-63` |
| 14 | **No smooth scroll behavior for page sections** — With the marketing hero + form content below the fold, users scroll abruptly. Adding `scroll-behavior: smooth` to the html element and potentially a subtle scroll-down indicator (animated chevron) in the hero would improve flow. | ⚪ Low | Micro-interactions | `app/globals.css` (missing `scroll-behavior: smooth`) |
| 15 | **Theme toggle lacks transition animation** — Switching between light/dark mode is instant (class swap). Premium apps use a smooth color-scheme transition (`transition: background-color 300ms ease, color 200ms ease`) on the root to create a polished theme switch effect. | 🟡 Medium | Micro-interactions | `components/toolbar/theme-control.tsx:22-27` |
| 16 | **Input border-radius (30px pill) feels inconsistent with card radius (22px)** — Inputs use `rounded-4xl` (30px pill shape) while cards use 22px radius. This mix of curvature values creates a subtle lack of system coherence. Standardize on a radius scale. | ⚪ Low | Visual Design | `components/ui/button.tsx:7`, `app/globals.css:75` |
| 17 | **Page size is ~950KB — slightly heavy for a landing page** — The fully loaded page weighs ~991KB. For a relatively simple form page, this suggests some optimization opportunities (tree-shaking, code splitting, or font subsetting for Noto Sans). | ⚪ Low | Performance | `app/layout.tsx:12` (font), overall bundle |
| 18 | **INP of 648ms is high** — The Interaction to Next Paint metric at 648ms indicates slow response to user interactions. This may be related to the dynamic import of RecentGames or heavy re-renders. Target should be under 200ms. | 🟠 High | Performance | `components/poker/home-page.tsx:6-9`, client-side rendering pipeline |
| 19 | **Brand logo is text-only with no icon/mark** — "Planning Poker" as plain `text-sm` on mobile is weak branding. A small poker chip icon, card suit, or stylized "PP" mark would strengthen brand recognition and add visual interest to the toolbar. | ⚪ Low | Visual Design | `components/toolbar/toolbar.tsx:16-18` |
| 20 | **No entry animation stagger for feature list items** — The 4 feature cards appear simultaneously. Staggering their entrance (50-100ms delay between each) creates a cascade effect that draws the eye down the list, a hallmark of Apple's reveal animations. | 🟡 Medium | Micro-interactions | `app/[lang]/page.tsx:33-41` |

---

## Criticality Legend
- 🔴 **Critical**: Breaks functionality or violates accessibility standards
- 🟠 **High**: Significantly impacts user experience or design quality
- 🟡 **Medium**: Noticeable issue that should be addressed
- ⚪ **Low**: Nice-to-have improvement

---

## Next Steps

### Priority 1 — Visual Polish (Issues #1, #2, #3, #4)
- Introduce a glass/frosted-glass card style using `backdrop-blur-xl` + semi-transparent backgrounds
- Add icons or subtle illustrations to the 4 feature cards
- Tone down the orange edge glow to a subtle radial gradient behind the hero
- Increase hero font size and spacing for more impact

### Priority 2 — Micro-interactions (Issues #5, #6, #7, #8, #15, #20)
- Add hover elevation/scale effects on feature cards and CTA button
- Implement staggered entry animations using intersection observer or CSS animation-delay
- Smooth theme toggle transition on the root element
- Polish radio/checkbox animations with scale transforms

### Priority 3 — UX Refinements (Issues #9, #10, #11)
- Add active route indicator to nav links
- Implement skeleton loading for recent games
- Improve table row hover feedback

### Priority 4 — Performance (Issues #17, #18)
- Investigate INP bottleneck — likely reducible by optimizing client component boundaries
- Audit bundle for unused code, consider font subsetting
