# Acceptance measurements: what to time, and how to verify placement

Two things learned the hard way, written down so the next change does not relearn them.

## 1. Time the whole chain, every action, from process start

A measurement is only useful if it covers what the user waits for. The failure that produced this
note: the browser launch was timed (0.36s, fine), and `waitFor` was timed (fine), so the suite was
declared fast — while a single `tripleClick` in the middle silently burned 8 seconds against a
selector that never matched, with `.catch(() => {})` swallowing the timeout.

The fix is not "measure more carefully". It is structural:

- **Start the clock before the browser exists**, not inside the suite. `openBrowser()` is part of
  the cost.
- **Instrument every helper, not just the one you suspect.** Wrap `goto`, `waitFor`, `read`,
  `count`, `click`, `tripleClick`, `hover`, `type`, `press`, `moveAway`. A stall hides in whichever
  function was not wrapped.
- **Report the offset from run start, not only the duration.** Knowing "8005ms happened at @768ms"
  locates the stall; "8005ms" alone does not.
- **Never swallow a timeout.** `.catch(() => {})` turns a stall into silence. If an action is
  genuinely optional, the timeout must still be short and the failure still visible.

Tools that do this: `tools/probe-startup.mjs` (phases from process start) and
`tools/probe-phases.mjs` / `tools/probe-lifecycle-phases.mjs` (every action, offset-tagged).

## 2. Placement is a requirement, so it needs its own assertions

The floating surfaces are the feature, not decoration. A toolbar that opens in the wrong place, or a
comment panel that covers the passage it describes, is broken even when every DOM assertion passes.

### The requirements, as the source implements them

| Surface | Placement rule | Where |
| --- | --- | --- |
| Action toolbar (`.qc-popup`) | Under the selection, centred on the pointer's release point, clamped into the readable band; flips above only if it does not fit below | `popovers.js: placeNear`, `anchorInTranscript(…, 'below')` |
| Compose box (`.qc-compose`) | Same rule as the toolbar: near the release point, inside the band | `popovers.js: createPopovers` |
| Comment panel (`.qc-bubble-panel`) | Above its gutter bubble, right edges flush, gap `BUBBLE_CLEARANCE = 30` | `markers.js`, `layout.js: anchorAboveBubble` |
| Gutter marker (`.qc-marker`) | Right gutter of the text column, vertically level with the **top** of the annotated passage | `markers.js`, `layout.js: columnElement` |
| Chip card (`.qc-card`) | Above the chip | `cards.js: AnnotationCard` |
| Chip remove × (`.qc-chip-remove`) | Pinned to the chip's left glyph slot, positioned by its centre | `cards.js` |

### What must be asserted for each

1. **Attached to the right anchor.** Not merely "visible". For the toolbar that means its top edge
   starts at or below the selected line and within ~120px of it — which fails if it fell back to a
   fixed corner. For the comment panel that means its bottom edge is `BUBBLE_CLEARANCE` above the
   bubble's top, within a few pixels.
2. **Inside the viewport.** A surface that renders off-screen is functionally absent. Check
   `top >= 0 && left >= 0 && bottom <= innerHeight && right <= innerWidth`.
3. **Does not cover what it describes.** The comment panel must sit above the passage, and the
   passage must still be lit; otherwise the user loses the referent.
4. **Follows its anchor.** After scrolling, the surface must move with the passage rather than stay
   pinned to the viewport. This is the assertion that catches "positioned once on open".
5. **Excluded from the highlight.** The marker's own ordinal and the panel must not be painted by
   the passage highlight (`data-qc-ignore`).

### Measured values (from tools/probe-placement.mjs)

These are read from the live page. They are not the source constants, and the difference matters:

| Surface | Measured | Note |
| --- | --- | --- |
| Toolbar vs selected line | `top` sits 33px below the line's top, i.e. 12px INSIDE the line box | The line box is taller than the glyphs, so "below the line" and "inside the line box" are the same thing here |
| Marker vs passage top | delta 0px | Strictly level |
| Comment panel vs bubble | gap 2–5px, right edge 8px inside the bubble's | `BUBBLE_CLEARANCE = 30` is a container-space offset, not a visual gap — asserting the constant would fail |

That last row is the reason this file exists. `BUBBLE_CLEARANCE = 30` reads like "the panel sits
30px above the bubble". It does not: the panel is positioned in the scroll container's coordinate
space (`bottom: -(height + 30)` relative to its bubble's positioning context) and the container
clips it. An assertion written from the constant would be wrong, and would have been "fixed" by
weakening it until it passed.

### What is covered now

In `accept-lifecycle.mjs`:

- toolbar: under the selection, inside the viewport, horizontally aligned, overlapping the line box
- marker: level with the passage top, inside the viewport
- toolbar position is asserted from the real pointer rect, so a fallback placement fails

### What is still not covered

- the comment panel's gap to its bubble, and its right-edge alignment
- the chip card's position relative to its chip
- the chip remove ×'s position within the chip's glyph slot
- every "follows its anchor after scroll" case

These remain requirements that no assertion protects. A change that broke the panel's gap, or made
a surface stop following scroll, would pass every suite in this repository.

### Resetting a polluted session

A suite that fails mid-way skips its own cleanup, so debris accumulates and then makes *unrelated*
assertions fail — which reads as a regression when it is leftovers. `tools/reset-session.mjs`
deletes every annotation through the plugin's own control and empties the composer, then reports
the final counts. Run it after any failed acceptance run.
