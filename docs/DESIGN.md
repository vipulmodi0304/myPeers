---
name: myPeers
description: See which McGill classmates are studying your course right now, and study together.
colors:
  paper: "#ffffff"
  paper-2: "#f4f5f7"
  desk: "#eceef1"
  toner: "#111214"
  toner-2: "#474b54"
  toner-3: "#6b6f79"
  rule: "#e0e2e7"
  rule-strong: "#c4c8cf"
  ballpoint: "#2340c8"
  red-pen: "#c8102e"
  live-green: "#138a42"
  break-amber: "#935400"
  you-yellow: "#ffe94a"
  ink-coral: "#ff9a85"
  ink-orange: "#ffb84f"
  ink-green: "#8deb7c"
  ink-turquoise: "#5fe0d2"
  ink-blue: "#84ccff"
  ink-lilac: "#c9a8ff"
  ink-pink: "#ff90cc"
  night-paper: "#17181b"
  night-toner: "#ecede8"
typography:
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(50px, 10.5vw, 96px)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.03em"
    fontVariation: '"wdth" 118'
  page-title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.03em"
    fontVariation: '"wdth" 118'
  heading:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 750
    lineHeight: 1.1
    letterSpacing: "-0.015em"
    fontVariation: '"wdth" 108'
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  code:
    fontFamily: "Fragment Mono, ui-monospace, monospace"
    fontSize: "14.5px"
    fontWeight: 400
    fontFeature: '"tnum"'
  pen-note:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    fontVariation: '"wdth" 96'
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  sheet: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.you-yellow}"
    textColor: "{colors.toner}"
    typography: "{typography.body}"
    height: "40px"
    padding: "0 16px"
  button-primary-disabled:
    backgroundColor: "{colors.rule}"
    textColor: "{colors.toner-3}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.toner}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.toner}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
  course-code:
    textColor: "{colors.toner}"
    typography: "{typography.code}"
---

# Design System: myPeers

## Overview

**Creative North Star: "Highlighter"**

myPeers looks like a student's own printed notes in the middle of a study session. The page is a cool white sheet with toner-black type and hairline rules. Links and annotations are in ballpoint blue, and errors in red pen. Every course owns one highlighter ink, swiped behind its code as a hand-drawn band with ragged chisel ends. The same course is the same ink everywhere: its code, the avatars of people studying it, its rooms, and the room timer.

Highlighting is the system's one active-state language. Whatever is happening now gets highlighted in: a classmate who just checked in, the page you are on, the selected filter, the timer filling up. Yellow is not a course ink. It is kept for you and for actions: the main button, the active tab, your own status.

The landing page is the loudest surface: a 96px wide-black headline whose course code keeps re-highlighting, and a printed sample board under it. The app screens use the same materials but stay calm and dense, because people keep them open for hours. Dark mode is the same sheet at night. The paper turns graphite, the inks get brighter, and text sitting on a band turns black.

**Key Characteristics:**
- A white sheet, black toner, hairline rules and a 2px toner rule under every page title.
- Seven course inks plus yellow for "you", always as a swiped band behind toner text.
- Archivo set wide and black for titles, Archivo for the interface, Fragment Mono for data (course codes, room codes, times).
- Flat: depth only for things that float over the page (menus, dialogs, toasts).
- Motion means "this just happened": the swipe and the pen stroke.

## Colors

A neutral printed page carrying saturated fluorescent inks, used only as bands behind text.

### Primary
- **You Yellow** (you-yellow): the main action on a screen, the active nav item and tab, the selected filter, your own status and the wordmark's "Peers". Never a course colour.

### Secondary
- **Course inks** (ink-coral, ink-orange, ink-green, ink-turquoise, ink-blue, ink-lilac, ink-pink): one per course, chosen by `web/src/lib/courseColor.ts` (hand-picked for big first and second year courses so the ones taken together never share an ink, hashed for the rest). Each ink has a darker `-ink` text value for coloured text on paper and a `-soft` wash for avatars and arrival highlights.

### Tertiary
- **Ballpoint Blue** (ballpoint): links, focus rings, the text caret and handwritten margin notes.
- **Red Pen** (red-pen): errors, unread counts and destructive actions.
- **Live Green** (live-green) and **Break Amber** (break-amber): the studying dot and "On a break" text only.

### Neutral
- **Paper** (paper): the sheet, the main surface of every screen.
- **Paper 2** (paper-2): form areas, hover rows, the received chat bubble.
- **Desk** (desk): the frame behind the app's sheet and under the sidebar.
- **Toner, Toner 2, Toner 3** (toner, toner-2, toner-3): text, secondary text and metadata. Toner 3 still passes 4.5:1 on paper.
- **Rule, Rule strong** (rule, rule-strong): dividers and control borders.

### Named Rules
**The Yellow Is You Rule.** Yellow never marks a course. If something is yellow, it is you, your choice, or the action to take.

**The Band Not Fill Rule.** Inks appear as hand-swiped bands behind text or as the timer's fill, never as flat panel backgrounds or coloured borders. Text on a band is toner black in both themes.

## Typography

**Display Font:** Archivo Variable, width axis at 118 (with ui-sans-serif, system-ui)
**Body Font:** Archivo Variable, normal width
**Mono Font:** Fragment Mono

**Character:** One grotesque in two widths: stretched and black for titles like a printed handout heading, normal for everything you read and click. The mono is only for data.

### Hierarchy
- **Title** (800, clamp 50 to 96px, 0.95): landing headlines only.
- **Page title** (800, 34 to 42px, 0.95): one per app screen, always with the 2px toner rule under it.
- **Heading** (750, 19 to 24px, 1.1): section and dialog headings.
- **Body** (400, 15px, 1.5): interface text; landing paragraphs at 17 to 18px with a 34rem measure.
- **Label** (600, 13px): form labels and small group labels, sentence case.
- **Code** (Fragment Mono 400, 11.5 to 20px): course codes, room codes, times, the running header.

### Named Rules
**The Mono Means Data Rule.** Fragment Mono is for things a person reads as a code or a measurement. Never for headings, buttons or prose.

## Layout

The landing page runs on a 1180px column with 16px (phone) to 32px gutters. The hero is a stacked headline, then copy and actions, then the full-width sample board. The sections that follow alternate a dense working piece with quieter text. The app is a 232px sidebar on the desk beside a single sheet (14px top-left corner), with a top bar and bottom tabs on phones. Lists are printed tables: rows split by hairlines, with columns on wide screens and stacked two-line rows on phones. Studying-now content runs up to 1080px wide, and forms and profile to 640px.

## Elevation & Depth

The page is flat. Depth comes from paper tones (desk, paper, paper 2) and rules, not shadows. Only things floating above the page get a shadow: dropdown menus, dialogs and toasts.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 1px 2px rgb(17 18 20 / 0.06), 0 12px 32px -12px rgb(17 18 20 / 0.22)`): menus, dialogs and toasts only.

### Named Rules
**The Flat Sheet Rule.** Nothing printed on the page casts a shadow. If it isn't floating over the page, it gets a rule or a paper tone instead.

## Shapes

Controls have gently squared corners (8px), small toggles 6px, panels 12px, and the sheet and overlays 14px. Pills are not used: avatars and status dots are the only circles. Highlighter bands and the main button use a hand-swiped mask with uneven edges and chisel ends, stretched to their content.

## Components

### Buttons
- **Primary:** a yellow highlighter swipe behind bold toner text (no border, no radius; the mask gives the shape). On hover the band grows slightly, and it shrinks on press. When disabled, the band turns rule grey with toner 3 text. While loading it stays yellow with a spinner.
- **Secondary:** paper with a 1.5px rule-strong border (8px). Hover darkens the border to toner and tints the fill.
- **Ghost / Danger:** text only. Hover adds a paper 2 tint; danger uses red pen with a pale red tint.

### Course code
- **Style:** Fragment Mono in toner on its course's ink band. Use the low variant (a swipe under the bottom third) where many codes sit together, as in suggestions.
- **State:** newly arrived codes swipe in left to right (520ms).

### Inputs / Fields
- **Style:** paper, 1.5px rule-strong border, 8px corners, 44px tall.
- **Focus:** the border goes toner, with a 3px ballpoint ring at 20%, and the caret is ballpoint blue.
- **Error / Disabled:** red-pen border and a red message under the field.

### Navigation
- **Style:** a sidebar on the desk with an icon and label per item. The active label is highlighted yellow and re-swipes on each switch. On phones, bottom tabs use the same highlighted label.

### Filters and quick picks
- **Style:** plain text options separated by hairline rules. The selected one is highlighted yellow. Radio groups (status, timer mode) sit in a thin ruled box.

### Room timer
- **Signature:** the remaining time in wide black numerals. The course ink fills behind them as the round runs, and a clipped toner copy keeps the digits black wherever the ink has reached. It flashes three times at zero.

### Whiteboard
- **Style:** graph paper (20px squares in pale print blue) on a fixed 16:10 board. Strokes are stored as fractions of the board, so its shape is the same on every screen.

## Do's and Don'ts

### Do:
- **Do** highlight what just happened with the swipe, and only that.
- **Do** put a 2px toner rule under page titles and hairlines between rows.
- **Do** give every course its ink through `courseVars()` so the code, avatars, rooms and timer agree.
- **Do** write margin notes in ballpoint blue when something on the page needs explaining (for example, that the landing board shows sample classmates).

### Don't:
- **Don't** use yellow for a course, or a course ink for an action.
- **Don't** add shadows, cards or pills to things printed on the page.
- **Don't** put coloured text directly on a band; text on ink is toner black.
- **Don't** split a highlighted phrase across lines; bands are one phrase, one line.
