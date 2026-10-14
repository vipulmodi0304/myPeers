# Design notes

**Subject.** McGill students finding classmates who are studying the same course *right now*, and studying together. The course code (COMP 251, MATH 240) is how students identify what they're doing, so it is the core visual unit of the interface.

**Audience.** McGill undergrads on a laptop in a library or on a phone between classes. Secondary: recruiters opening the demo for two minutes.

## Tokens

| Name        | Light     | Dark      | Use |
|-------------|-----------|-----------|-----|
| Paper       | `#EEF1F5` | `#121826` | Page background, cool like a winter library, not cream |
| Surface     | `#FFFFFF` | `#1A2232` | Panels, inputs |
| Ink         | `#17203A` | `#E6EBF3` | Text, primary buttons |
| Slate       | `#5A6479` | `#98A3B8` | Secondary text |
| Red         | `#D61F2C` | `#FF4F5C` | "Live" signal and the brand mark, used sparingly |
| Highlighter | `#FFE36E` | `#D9B93C` | Marks *your* course, like a textbook highlighter |

**Type.** One family, Archivo, used across its width axis. Course codes are set condensed and heavy, like the spine labels on library shelves. Everything else is normal width. Tabular numbers for timers and counts.

**Layout.** People are grouped under their course code (a "shelf"), your course first and highlighted. Rows, not cards. Rooms are a big whiteboard with a narrow side column for the timer, who's here, and chat.

**Motion.** Only when something real happens: a classmate checking in slides into the list with a brief highlight; reactions float up over the whiteboard when someone sends one. `prefers-reduced-motion` turns both off.

**Words.** Sentence case, plain verbs. The action keeps its name: "Check in" produces "Checked in". Empty states tell you what to do next.
