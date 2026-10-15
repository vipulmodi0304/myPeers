# Design notes

**Subject.** McGill students finding classmates who are studying the same course *right now*, and studying together.

**Audience.** McGill undergrads on a laptop in a library or on a phone between classes. Also recruiters opening the demo for two minutes.

**Idea.** A calm, precise tool whose colour comes from courses. Students colour-code their courses in planners and calendars, so every course gets its own hue, and the same course is the same colour everywhere: its label, the avatars of people studying it, its rooms, a room's timer. The interface around that stays quiet.

## Tokens

| Name | Light | Dark | Use |
|---|---|---|---|
| Canvas | `#F7F7F5` | `#131417` | Page and sidebar background |
| Surface | `#FFFFFF` | `#1A1B1F` | Main panel, inputs |
| Ink / Ink 2 / Ink 3 | `#1C1D22` / `#4D5059` / `#7B7E87` | `#EDEDEA` / `#B2B4BA` / `#888B92` | Text, secondary, tertiary |
| Line | `#E6E5E0` | `#2B2D32` | Hairline dividers (no drop shadows on content) |
| Brand red | `#E2363A` | `#FF5A5E` | Live dot and the one main action per page |

**Course colours** (`--c0` to `--c7`): tomato, amber, sage, teal, cornflower, plum, rose, olive. Each has a text-safe foreground and a soft tint for light and dark. Big courses that often appear together have hand-picked hues; everything else is hashed (`web/src/lib/courseColor.ts`).

**Type.** Hanken Grotesk for the interface. Bricolage Grotesque, heavy and narrow, for headlines and course codes only. Tabular numbers for timers and counts.

**Layout.** Sidebar plus one main panel. Lists are rows split by hairlines, not cards. Your check-in is a slim bar edged in your course colour.

**Motion.** Only when something real happens: a classmate arriving gets a brief wash of their course colour; reactions float over the whiteboard; the landing headline's course code cycles. `prefers-reduced-motion` turns all three off.

**Words.** Sentence case, plain verbs. An action keeps its name: "Check in" produces "Checked in". Empty states say what to do next.
