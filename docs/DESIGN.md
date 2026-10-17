# Design notes

**Subject.** McGill students finding classmates who are studying the same course *right now*, and studying together.

**Audience.** McGill undergrads on a laptop in a library or on a phone between classes. Also recruiters opening the demo for two minutes.

**Idea: "Library floor".** It should feel like a product students would actually open, not a template. The reference points were social apps like Partiful and Luma rather than dev tools. Course codes are printed as bright stickers, the way students colour-code their planners, and the same course is the same colour everywhere: its sticker, the avatars of people studying it, its rooms, a room's timer. The landing page is loud. The app screens use the same type and colours but stay calm, because people sit in them for hours.

## Tokens

| Name | Light | Dark | Use |
|---|---|---|---|
| Canvas | `#F4F2FB` | `#100D16` | Page background, a lilac-tinted paper |
| Surface | `#FFFFFF` | `#18141F` | Main panel, cards, inputs |
| Ink / Ink 2 / Ink 3 | `#17131F` / `#4B4559` / `#7A748A` | `#F0EDF7` / `#B6AFC6` / `#8A839B` | Text, secondary, tertiary. Ink is also the primary button colour. |
| Line / Line strong | `#E3DFEE` / `#CFC9DF` | `#2A2434` / `#3A3347` | Dividers and quiet borders |
| Brand red | `#E2363A` | `#FF5A5E` | Logo and unread counts only |
| Green | `#15803D` | `#4ADE80` | "Studying" live dot |

**Course colours** (`--c0` to `--c7`: red, orange, green, teal, blue, violet, pink, mustard). Each has three values: a fill that white text sits on in both themes (the sticker), an `-ink` value for coloured text on the page, and a `-soft` tint. Big courses that often appear together have hand-picked hues; everything else is hashed (`web/src/lib/courseColor.ts`).

**Stickers.** A 2px ink edge plus a hard offset shadow (`.sticker`). Used on purpose and sparingly: primary buttons, your own check-in, dialogs, menus, toasts, and the landing page's floating bubbles. Lists and secondary surfaces stay flat with thin borders.

**Type.** Hanken Grotesk for the interface. Bricolage Grotesque for headings and course codes: narrow and heavy for course codes, and set as an uppercase poster (`.poster`) only for the two big landing headlines. Tabular numbers for timers and counts.

**Layout.** Sidebar plus one main panel on desktop, top bar plus bottom tabs on phones. Rounded pills for buttons and filters. Lists are rows split by hairlines.

## Motion

The library is [Motion](https://motion.dev) (`motion/react`), loaded lazily through `LazyMotion` so it isn't in the first download. `MotionConfig reducedMotion="user"` turns transform animations off for anyone with reduce motion enabled, and the CSS animations are switched off in the same media query.

- **Landing:** one orchestrated moment on load (the floating classmates pop in on a spring, then drift), the headline's course sticker swapping, and a check-in ticker. The illustrations further down only play while they're on screen.
- **App:** motion answers something that happened. A classmate checking in slides into the list with a wash of their course colour, people leaving fade out, new messages pop in from their side, the active nav pill slides between items, pages rise in slightly on navigation, and the timer rings in the course colour when it hits zero.

## Words

Sentence case, plain verbs. An action keeps its name: "Check in" produces "Checked in". Empty states say what to do next.
