# Design Review Results: Game Page (`/fr/game/:id`)

**Review Date**: 2026-03-07
**Route**: `/fr/game/439f12e2-e87f-490e-8aa8-9f40cd4337db`
**Focus Areas**: Visual Design, UX/Usability, Micro-interactions/Motion, Consistency (with updated home page)
**Benchmark**: Apple-inspired minimal glass aesthetic matching the redesigned home page

---

## Summary

The game page is functionally solid — voting, revealing, timer, player management all work. However, visually it looks disconnected from the updated home page. The controller card lacks glass styling, action buttons feel utilitarian rather than polished, and the colorful voting cards — while charming — have no hover/press animations. The biggest opportunity is bringing the glass card aesthetic, subtle animations, and consistent spacing from the home page into this collaborative game experience.

---

## Issues

| # | Issue | Criticality | Category | Location |
|---|-------|-------------|----------|----------|
| 1 | **Controller card lacks glass styling** — The game controller `Card` uses the default flat `bg-card` with `ring-1` shadow. The home page now uses `glass-card dark:dark-glass-card` with backdrop-blur. This is the most visible consistency gap between pages. | 🟠 High | Consistency | `components/poker/game-controller/index.tsx:182` |
| 2 | **Players panel has no card wrapper** — The players section uses a bare `div` with `border border-primary/20` instead of the `Card` component. It should use a glass Card for consistency with the controller and home page. | 🟠 High | Consistency | `components/poker/players.tsx:27` |
| 3 | **Voting cards lack hover animation feedback** — Cards have `hover:-translate-y-0.5 hover:scale-[1.04]` but no shadow elevation change on hover. They also lack an `active:scale-[0.97]` press state. The hover effect is subtle to the point of being invisible. Apple-style card interactions use more pronounced lift + shadow. | 🟠 High | Micro-interactions | `components/poker/card-picker.tsx:67` |
| 4 | **No entry animation on game page load** — The entire game page appears instantly with no staggered entry. The home page uses `animate-scale-in`, `animate-fade-in-up`, etc. The game page should animate the controller, players panel, and card picker in sequence. | 🟠 High | Micro-interactions | `components/poker/game-area.tsx:36-65` |
| 5 | **Action buttons (Reveal, Restart, etc.) lack hover elevation** — The round `ControllerButton` components use standard `Button` variants but don't have the updated `hover:shadow-md active:scale-[0.97]` that the home page CTA now has. The `rounded-full` class also conflicts with the `rounded-xl` standardization from the home page. | 🟡 Medium | Consistency | `components/poker/game-controller/index.tsx:304-317` |
| 6 | **"Copied" toast notification is unstyled** — The invite copy confirmation uses a manually positioned `fixed` div. It should use a glass-styled toast with entry/exit animation for consistency. Currently it pops in/out abruptly. | 🟡 Medium | Micro-interactions | `components/poker/game-controller/index.tsx:272-283` |
| 7 | **Card selection state is only a ring** — The selected card gets `ring-4 ring-primary/70` but no translateY or shadow elevation. Apple-style selection would lift the card noticeably (`-translate-y-3`) and add a pronounced shadow, making the selection feel physical. | 🟡 Medium | Visual Design | `components/poker/card-picker.tsx:72-73` |
| 8 | **Timer section doesn't match glass aesthetic** — The "Minuteur désactivé" bar uses `border-border bg-card` which is flat. It should use a subtle glass-like inner section with backdrop-blur to blend with the controller card. | 🟡 Medium | Consistency | `components/poker/timer/timer.tsx:195` |
| 9 | **Results table lacks glass treatment** — When votes are revealed, the results table uses standard `bg-muted/40` header and plain `bg-background` rows. It should match the glass aesthetic with semi-transparent backgrounds. | 🟡 Medium | Consistency | `components/poker/results/results-section.tsx:45-100` |
| 10 | **Player cards lack hover feedback** — `PlayerCard` has only `transition-opacity` for dimming non-voters but no hover effect. Hovering over a player card should show a subtle background highlight, especially since the "Remove" action is contextual. | 🟡 Medium | Micro-interactions | `components/poker/player-card.tsx:39` |
| 11 | **"Session terminée !" text has no animation** — When the round ends, the card picker CTA changes to "Session terminée !" without any visual transition. This state change should be animated (fade or scale) to draw attention. | 🟡 Medium | Micro-interactions | `components/poker/card-picker.tsx:44-48` |
| 12 | **Auto-reveal toggle is custom-built instead of using shadcn Switch** — The toggle uses a manually styled `button[role=switch]`. The project has shadcn available which includes a proper `Switch` component with consistent styling. | 🟡 Medium | Consistency | `components/poker/game-controller/auto-reveal-toggle.tsx:23-39` |
| 13 | **Game page wrapper has minimal padding** — `px-2` on the page wrapper is very tight. Combined with no max-width constraint on the card picker, the layout feels cramped on large screens. Should use `px-4` minimum and constrain content width. | ⚪ Low | Visual Design | `app/[lang]/game/[id]/page.tsx:19` |
| 14 | **Error retry button is a plain `<button>` without Button component** — The error state uses a raw `<button>` with `text-sm underline` class instead of the shadcn `Button` component. This breaks design consistency. | ⚪ Low | Consistency | `components/poker/poker.tsx:32-38` |
| 15 | **No subtle glow backdrop like home page** — The home page has a `bg-primary/8 blur-[120px]` radial glow behind the hero. The game page lacks any such ambient element, making it feel flat compared to the home. | ⚪ Low | Consistency | `app/[lang]/game/[id]/page.tsx` |
| 16 | **Card picker gap is 24px (gap-6) — feels wide on mobile** — The `gap-6` between voting cards works on desktop but creates excessive spacing on mobile where cards are already small (w-20). Should reduce to `gap-3 md:gap-6`. | ⚪ Low | Visual Design | `components/poker/card-picker.tsx:54` |
| 17 | **LCP of 14.9s is extremely high** — The Largest Contentful Paint metric is 14.9 seconds, indicating significant rendering delays. This needs investigation — likely related to the dynamic imports or Convex data loading. | 🟠 High | UX/Usability | `components/poker/poker.tsx` (loading state), `components/poker/timer/timer.tsx:17` |

---

## Criticality Legend
- 🔴 **Critical**: Breaks functionality or violates accessibility standards
- 🟠 **High**: Significantly impacts user experience or design quality
- 🟡 **Medium**: Noticeable issue that should be addressed
- ⚪ **Low**: Nice-to-have improvement

---

## Next Steps

### Priority 1 — Glass Consistency (Issues #1, #2, #8, #9)
- Apply `glass-card dark:dark-glass-card` to the game controller Card and players panel
- Update timer and results sections with glass-inspired inner styles

### Priority 2 — Card Interactions (Issues #3, #7, #11)
- Add pronounced hover lift (`hover:-translate-y-2 hover:shadow-lg`) and press scale (`active:scale-[0.97]`)
- Enhance selection state with `-translate-y-3` + `shadow-xl`
- Animate CTA text transitions

### Priority 3 — Entry Animations (Issue #4)
- Stagger `animate-scale-in` on controller → players → card picker

### Priority 4 — Polish (Issues #5, #6, #10, #12, #13, #14, #15, #16)
- Standardize action button radius, install shadcn Switch for toggle
- Add hover feedback to player cards
- Animate toast notification
- Add subtle glow backdrop
