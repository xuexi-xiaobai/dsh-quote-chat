/**
 * The package's stylesheet.
 *
 * One exported string, injected once by installStyles. It is a separate module because it is
 * large, contains no JavaScript, and a rule change should not mean scrolling past component code.
 *
 * Two constraints, both load-bearing:
 *
 *   - It is NOT named `CSS`. That identifier would shadow the browser's global `CSS` object — the
 *     one owning `escape` and `highlights` — for the whole module scope, and a shadowed global is
 *     exactly how the jump highlight once came to never paint.
 *   - The CSS contains no backticks, so this template literal cannot be terminated early.
 *     `chip-dom-guard.mjs` enforces that.
 */

export const STYLESHEET = `
.qc-popup{position:fixed;z-index:60;display:flex;align-items:stretch;gap:2px;padding:3px;
  border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay);
  box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:12.5px;line-height:1.2;color:var(--dsw-alias-label-primary);
  animation:qc-pop .1s ease-out;box-sizing:border-box}
@keyframes qc-pop{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
.qc-popup button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;
  display:flex;align-items:center;gap:5px;padding:6px 9px;border-radius:7px;cursor:pointer;white-space:nowrap}
.qc-popup button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.qc-popup button:disabled{opacity:.45;cursor:default}
.qc-popup button+button{box-shadow:inset 1px 0 0 var(--dsw-alias-border-l1)}
.qc-popup svg{flex:none;opacity:.8}

/* The compose panel: a compact dialog, larger radii to match the composer it sits above.
 *
 * The transition is declared here but only engages once the panel is DOCKED. A plain transition on the
 * top property would animate the first paint as well, so the panel would fly in from wherever it
 * rendered instead of appearing at its resting place above the selection.
 *
 * z-index -1 puts it BELOW the app's chrome, which is the required relationship: the header and the
 * composer must cover this panel when they overlap it.
 *
 * A negative z-index is deliberate. The header is a static element with no stacking context, so ANY
 * positioned element with a non-negative z-index paints above it — no value above zero can satisfy the
 * requirement. Negative values are valid for positioned elements and paint behind the in-flow content of the
 * stacking context, which is exactly "under the chrome, above the background".
 *
 * The old note claimed:
 * header are rendered by the host at higher layers, so when the panel is pushed under them it is
 * covered rather than floating on top. That is the requested behaviour.
 */
.qc-compose{position:absolute;z-index:6;width:min(420px,92vw);box-sizing:border-box;
  border:1px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));border-radius:18px;
  background:var(--dsw-alias-bg-overlay);
  box-shadow:0 16px 40px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.18);
  padding:12px;color:var(--dsw-alias-label-primary);
  font-size:12.5px;animation:qc-pop .1s ease-out;
  /* Smooth glide between the resting place and the docked slots. */
  transition:top .26s cubic-bezier(.22,.61,.36,1),left .26s cubic-bezier(.22,.61,.36,1)}
.qc-compose[data-docked="false"]{transition:none}
/* The gutter bubble's editor docks the same way the compose panel does, so it gets the same glide. */
.qc-bubble-panel[data-docked="false"]{transition:none}
.qc-bubble-panel{transition:top .26s cubic-bezier(.22,.61,.36,1),right .26s cubic-bezier(.22,.61,.36,1),left .26s cubic-bezier(.22,.61,.36,1)}
.qc-compose textarea{width:100%;box-sizing:border-box;resize:none;min-height:2.8em;max-height:9em;
  font:inherit;line-height:1.5;padding:9px 11px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);outline:none}
.qc-compose textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.qc-compose-row{display:flex;align-items:center;gap:8px;margin-top:10px}
.qc-compose-hint{flex:1;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.85;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qc-compose-confirm{appearance:none;border:0;border-radius:999px;min-width:26px;height:26px;
  padding:0 10px;flex:none;font:inherit;font-size:12px;font-weight:600;
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  /* A solid accent with white ink. The theme token alone was too pale against the
     popover surface in dark mode, leaving the button barely visible. */
  background:#1f6ae0;color:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,.28);
  transition:background .12s ease}
.qc-compose-confirm svg{margin-right:5px}
.qc-compose-confirm-text{white-space:nowrap}
.qc-compose-confirm:hover{background:#1a5cc4}
.qc-compose-confirm:active{background:#1550ac}
.qc-compose-cancel:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.qc-compose-cancel{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;border-radius:7px;
  padding:4px 10px;cursor:pointer;flex:none}

/* ── The right-gutter bubble ────────────────────────────────────────────────

   A blue speech bubble pinned to the right of the text column, level with the
   TOP of the annotated passage, carrying the same ordinal as the annotation's
   chip. It marks where a passage came from without touching the prose itself.

   Drawn with a tail, so it reads as a bubble rather than a plain badge: the tail
   points back at the passage it belongs to. */
/* The bubble is mounted INSIDE the row that holds its passage, and positioned
   with CSS alone.
  
   That is what makes it independent of zoom, wrapping and pane drags: it shares
   the row's box, so any transform of the row moves it by construction. Nothing
   recomputes its position, so nothing can go stale. right docks it to the
   column edge and top centres it on the row's first line.
  
   position:absolute against the row keeps it out of the text flow; the row is
   given position:relative only while it hosts a bubble. */
/* The bubble sits at the paragraph's top-right corner, INSIDE its box, in a
   gutter created with padding-inline-end on the HOSTING BLOCK.

   Why padding after all: reserving room outside the box (negative right) lets the
   scroll container clip the bubble, and reserving it with a border or by shrinking
   the content box re-wraps the prose. Padding is applied once, when the bubble is
   attached, and never changes afterwards - so the paragraph lays out exactly once
   and cannot flicker on subsequent passes. */
/* A hosting block reserves a right-hand gutter for its bubble.
   Applied once per block: the paragraph lays out with the gutter from the start, so
   adding a bubble never re-wraps the text and never changes the measured height. */
.qc-hosts-bubble{padding-right:28px}
.qc-marker{position:absolute;right:2px;top:0;z-index:2;
  /* The ordinal is CSS-generated, not a text node: a real node inside the paragraph
     would both join its textContent and be painted by the passage highlight. */
  content:"";
  display:flex;align-items:center;justify-content:center;
  min-width:19px;height:19px;padding:0 5px;
  border-radius:9.5px 9.5px 9.5px 3px;border:0;cursor:pointer;
  font-size:11px;font-weight:600;line-height:1;color:#fff;font-family:inherit;
  background:#2f7df6;
  box-shadow:0 1px 4px rgba(0,0,0,.22);
  transform-origin:left center;
  transition:transform .12s ease,background .12s ease,box-shadow .12s ease}.qc-marker::after{content:attr(data-qc-number);line-height:1}
.qc-marker:hover{transform:scale(1.16);background:#1f6ae0}
.qc-marker:active{transform:scale(1.04)}
/* Tables keep a distinct hue so a glance tells the two kinds apart. */
.qc-marker-table{background:#17a673}
.qc-marker-table:hover{background:#128a5f}
/* The bubble the editor belongs to stays lit while the editor is open. */
.qc-marker.qc-marker-active{background:#1f6ae0;box-shadow:0 0 0 2px rgba(47,125,246,.28),
  0 1px 4px rgba(0,0,0,.22)}

/* The bubble's own editor: change or delete the comment, without touching the
   annotated passage. Sits above the bubble but still below app chrome. */
/* In-flow placement: the panel is a child of the annotated paragraph, so it rides
   with the text (scroll, zoom, reflow) and needs no reposition listener. It sits just
   clear of the bubble so the two never overlap. */
/* z-index 6 — the SAME layer as the compose panel, and deliberately BELOW the composer (7).
 *
 * It used to be 40, which put the editor on top of the chat box: scrolling the panel down to the composer's position
 * drew it OVER the chat box, while the compose panel correctly slid underneath. Both editors now share one layer, so
 * the chrome covers them exactly as it covers the transcript text. 6 also keeps them above the code-block banner,
 * which is 6 as well and older in DOM order.
 */
.qc-bubble-panel{position:absolute;z-index:6;box-sizing:border-box;
  width:min(320px,80vw);padding:10px;
  border:1px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));border-radius:12px;
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);
  box-shadow:0 16px 40px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.18);
  display:flex;flex-direction:column;gap:8px;
  animation:qc-card-in .14s cubic-bezier(.2,.8,.3,1)}
.qc-bubble-panel .qc-bp-label{font-size:11.5px;font-weight:600;
  color:var(--dsw-alias-label-secondary);padding:0 1px}
.qc-bubble-panel textarea{box-sizing:border-box;width:100%;min-height:64px;
  resize:vertical;padding:7px 9px;border-radius:8px;font:inherit;font-size:12.5px;
  line-height:1.55;color:inherit;background:var(--dsw-alias-bg-layer-2);
  border:1px solid var(--dsw-alias-border-l2)}
.qc-bubble-panel textarea:focus{outline:none;
  border-color:var(--dsw-alias-state-accent-primary)}
.qc-bp-actions{display:flex;align-items:center;gap:6px}
/* Buttons carry a real hover/press state, not just a cursor change: a filled
   background shift on hover, a drop under the finger on press, and a focused ring
   for keyboard use. A pointer-only affordance is invisible at a glance. */
.qc-bp-actions button{appearance:none;font:inherit;font-size:12px;font-weight:500;
  cursor:pointer;padding:6px 13px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2);color:inherit;
  transition:background .14s ease,border-color .14s ease,transform .08s ease,
    box-shadow .14s ease,opacity .14s ease}
.qc-bp-actions button:hover:not(:disabled){
  background:var(--dsw-alias-bg-layer-3);
  border-color:var(--dsw-alias-border-l3)}
.qc-bp-actions button:active:not(:disabled){transform:translateY(1px) scale(.985)}
.qc-bp-actions button:focus-visible{outline:none;
  box-shadow:0 0 0 2px var(--dsw-alias-state-accent-primary)}
.qc-bp-actions button:disabled{opacity:.45;cursor:default}
/* The save button is the panel's primary action, so it uses a solid, saturated
   fill with white text.
   It previously painted with --dsw-alias-state-accent-primary, which is a BORDER
   and TEXT accent token, not a button fill: as a background it is pale, so white
   text on it was almost unreadable. The token is still used for the focus ring,
   which is what it is for. */
.qc-bp-actions .qc-bp-save{margin-left:auto;border-color:transparent;
  background:#1f6ae0;color:#fff;font-weight:600;
  box-shadow:0 1px 2px rgba(16,63,145,.28)}
.qc-bp-actions .qc-bp-save:hover:not(:disabled){
  background:#1a5cc4;color:#fff;
  box-shadow:0 3px 10px rgba(31,106,224,.38)}
.qc-bp-actions .qc-bp-save:active:not(:disabled){
  background:#1550ac;box-shadow:0 1px 3px rgba(16,63,145,.35)}
.qc-bp-actions .qc-bp-save:focus-visible{
  box-shadow:0 0 0 2px #fff,0 0 0 4px #1f6ae0}
/* Delete is a destructive action: it only looks dangerous once you are on it. */
.qc-bp-actions .qc-bp-delete{color:var(--dsw-alias-state-error-primary)}
.qc-bp-actions .qc-bp-delete:hover:not(:disabled){
  background:var(--dsw-alias-state-error-primary);color:#fff;
  border-color:transparent}

/* A short confirmation, so a save is not a silent state change. */
.qc-bp-done{position:fixed;z-index:41;pointer-events:none;
  padding:5px 10px;border-radius:8px;font-size:12px;color:#fff;
  background:rgba(24,24,24,.88);box-shadow:0 4px 14px rgba(0,0,0,.2);
  animation:qc-done .9s ease forwards}
@keyframes qc-done{
  0%{opacity:0;transform:translateY(3px)}
  18%{opacity:1;transform:translateY(0)}
  75%{opacity:1;transform:translateY(0)}
  100%{opacity:0;transform:translateY(-3px)}}

.qc-table-add{position:fixed;z-index:55;appearance:none;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
  border-radius:8px;padding:4px 9px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.14);
  display:flex;align-items:center;gap:5px;white-space:nowrap}
.qc-table-add:hover{background:var(--dsw-alias-bg-layer-2)}

/* The jump flash is a range highlight painted by the browser, not a positioned
   box: the ::highlight pseudo-element follows the text through scrolling and
   reflow, so it can never end up glowing over the composer while the passage is
   off-screen.

   The highlight pseudo-element cannot be transitioned — it takes no transition
   property — so the fade is produced by animating the painted colour itself. Two names are used:
   the transient jump ADDS the highlight and lets qc-flash-in run its own
   fade-in/fade-out; the editor HOLD registers a highlight that stays, so it does
   not animate out at all. */
::highlight(quote-chat-flash){background-color:rgba(255,214,0,.42);
  text-decoration:underline;text-decoration-color:rgba(255,196,0,.55);
  text-decoration-thickness:2px;
  animation:qc-hl-in .22s ease-out}
@keyframes qc-hl-in{
  from{background-color:rgba(255,214,0,0);text-decoration-color:rgba(255,196,0,0)}
  to{background-color:rgba(255,214,0,.42);text-decoration-color:rgba(255,196,0,.55)}}
/* The held highlight (used while a bubble's editor is open) fades in the same
   way but never fades out on its own. */
::highlight(quote-chat-hold){background-color:rgba(255,214,0,.42);
  text-decoration:underline;text-decoration-color:rgba(255,196,0,.55);
  text-decoration-thickness:2px;
  animation:qc-hl-in .22s ease-out}

/* ── The inline annotation chip ──────────────────────────────────────────────

   A rounded pill sitting in the composer's text flow, showing the annotation's
   label plus a leading glyph that names its kind:

     text     引文 glyph
     table    grid glyph

   On hover the glyph is replaced, in place, by a red × that removes the
   annotation. The × lives INSIDE the chip's left edge — it takes over the glyph's
   slot rather than floating outside — so the control is part of the pill and
   cannot drift away from it.

   Both glyphs and the × are drawn by pseudo-elements and a positioned overlay
   keyed on the chip's own box. The chip's children are React's; nothing here
   writes into them. */
/* The chip follows the app's theme instead of hard-coding a light grey.
   --qc-chip-bg resolves to the app's own layer token, so dark mode is inherited
   rather than guessed at; the fallbacks only apply outside the host. */
[data-composer-chip="quote-chat"]{display:inline-flex;align-items:center;
  vertical-align:baseline;max-width:20em;padding:2px 9px 2px 7px;margin:0 1px;
  border-radius:999px;
  border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08));
  background:var(--qc-chip-bg, var(--dsw-alias-bg-layer-2, #f2f2f2));
  color:var(--dsw-alias-label-primary, #181818);
  font-size:12.5px;line-height:1.5;cursor:pointer;position:relative;
  transition:background .14s ease}
[data-composer-chip="quote-chat"]:hover,
[data-composer-chip="quote-chat"]:focus-within{
  background:var(--qc-chip-bg-hover, var(--dsw-alias-bg-layer-3, #e8e8e8));
  border-color:var(--dsw-alias-border-l3, rgba(0,0,0,.16))}
/* The host's own marker glyph is the first child; it is hidden and replaced by a
   CSS glyph so the node's contents are never touched. */
[data-composer-chip="quote-chat"] > span:first-child{display:none}
/* The kind glyph, occupying the left slot. */
[data-composer-chip="quote-chat"]::before{content:"";
  flex:none;width:13px;height:13px;margin-right:6px;
  background-color:currentColor;opacity:.75;
  -webkit-mask-image:var(--qc-glyph, var(--qc-glyph-text));
  mask-image:var(--qc-glyph, var(--qc-glyph-text));
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-position:center;mask-position:center;
  -webkit-mask-size:contain;mask-size:contain;
  transition:opacity .12s ease,visibility .12s ease}
/* Hovering hides the kind glyph: the × takes its place in the same slot. */
[data-composer-chip="quote-chat"]:hover::before,
[data-composer-chip="quote-chat"]:focus-within::before{opacity:0;visibility:hidden}
/*
 * The ordinal, drawn here rather than relying on the host's label.
 *
 * The host renders its label inside a child span, and that text was not reaching
 * the screen: the chip showed a glyph and nothing else. A pseudo-element is
 * rendered by CSS from an attribute the plugin sets, so it cannot be lost to the
 * editor's own rendering.
 */
[data-composer-chip="quote-chat"]::after{content:attr(data-qc-label);
  order:1;margin-left:0;font-size:12.5px;line-height:1.5;
  color:var(--dsw-alias-label-primary, #181818);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Keep the host's own label out of the way so the ordinal is the only text. */
[data-composer-chip="quote-chat"] > span:last-child{display:none}

/* Glyph: a rounded rectangle with a quote stroke inside it — the same "quoted
   text" mark the reference shows. Table chips get a grid glyph. */
:root{
  --qc-glyph-text:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='3' width='12' height='10' rx='2.5' fill='none' stroke='black' stroke-width='1.4'/><path d='M5.6 6.6h4.8M5.6 9.2h3' stroke='black' stroke-width='1.3' stroke-linecap='round'/></svg>");
  --qc-glyph-table:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='3.2' width='12' height='9.6' rx='1.8' fill='none' stroke='black' stroke-width='1.3'/><path d='M2 6.4h12M2 9.6h12M6.2 3.2v9.6' stroke='black' stroke-width='1.1'/></svg>");
}
[data-composer-chip="quote-chat"][data-qc-kind="table"]{--qc-glyph:var(--qc-glyph-table)}

/* ── The hover removal control ───────────────────────────────────────────────

   The red × sits in the chip's left slot, replacing the kind glyph on hover.

   Shaped to belong to the pill: fully rounded like the chip, sized to the glyph
   box it covers, and centred on the same point (the inline style positions it by
   its centre).

   The cross is drawn as an SVG, not typed as a character. A text multiplication
   sign inherits the font's baseline and side bearings, which made it sit high and
   look undersized no matter how it was nudged; two strokes give exact geometry
   and scale with the button. */
.qc-chip-remove{position:fixed;z-index:45;
  appearance:none;box-sizing:border-box;margin:0;padding:0;border:0;
  border-radius:999px;background:#e8291c;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  transform:translate(-50%,-50%);box-shadow:0 0 0 1.5px var(--dsw-alias-bg-layer-1, #f2f2f2);
  transition:background .12s ease,transform .12s ease}
.qc-chip-remove svg{display:block;width:10px;height:10px;flex:none;
  pointer-events:none}
.qc-chip-remove svg path{stroke:#fff;stroke-width:2.1;stroke-linecap:round;
  fill:none;vector-effect:non-scaling-stroke}
.qc-chip-remove:hover{background:#c81f14;transform:translate(-50%,-50%) scale(1.1)}

/* ── The hover preview card ──────────────────────────────────────────────────

   A compact panel floating above the chip, holding the rendered passage. Sized to
   its content: a short passage should not open a 560px sheet. max-width caps
   it, width:max-content lets it stay small.

   No ordinal and no removal control inside — the chip carries both. */
.qc-card{position:fixed;z-index:50;
  width:max-content;max-width:min(380px,80vw);box-sizing:border-box;
  border:1px solid var(--dsw-alias-border-l3, rgba(0,0,0,.07));border-radius:12px;
  background:var(--dsw-alias-bg-overlay, #fff);
  box-shadow:0 8px 26px rgba(0,0,0,.15),0 2px 6px rgba(0,0,0,.05);
  padding:8px 10px;color:var(--dsw-alias-label-primary, #181818);
  animation:qc-card-in .16s cubic-bezier(.2,.8,.3,1)}
@keyframes qc-card-in{
  from{opacity:0;transform:translateY(4px) scale(.98)}
  to{opacity:1;transform:translateY(0) scale(1)}}
/* The exit runs while the card is still mounted; the parent unmounts it after
   CARD_EXIT_MS. Filled mode keeps the final keyframe's state, so the card does not
   flash back to full opacity on the last frame. */
.qc-card-out{animation:qc-card-out .13s ease-in forwards}
@keyframes qc-card-out{
  from{opacity:1;transform:translateY(0) scale(1)}
  to{opacity:0;transform:translateY(3px) scale(.985)}}
.qc-card-comment{margin:0 0 7px;padding:6px 9px;border-radius:8px;
  background:var(--dsw-alias-bg-layer-2, #f6f6f6);color:#4b4b4b;font-size:12px;line-height:1.55;
  white-space:pre-wrap;word-break:break-word}
.qc-card-body{max-height:220px;overflow:auto;font-size:12.5px;line-height:1.6;
  word-break:break-word;
  /* The captured markup keeps the answer's own class names, but the stylesheet
     those classes belong to lives in the transcript, not here — so nothing is
     inherited automatically. These defaults make the fragment readable on its
     own: headings, lists, quotes and code all get a local shape. */
}
.qc-card-body h1,.qc-card-body h2,.qc-card-body h3,.qc-card-body h4{
  margin:.5em 0 .35em;font-size:1em;font-weight:700;line-height:1.4}
.qc-card-body p{margin:.35em 0}
.qc-card-body ul,.qc-card-body ol{margin:.35em 0;padding-left:1.35em}
.qc-card-body li{margin:.15em 0}
.qc-card-body blockquote{margin:.4em 0;padding-left:.7em;
  border-left:2px solid var(--dsw-alias-border-l2, #e0e0e0);color:var(--dsw-alias-label-secondary, #555)}
.qc-card-body code{font-family:ui-monospace,monospace;font-size:.92em;
  padding:.1em .3em;border-radius:4px;background:var(--dsw-alias-bg-layer-2, #f2f2f2)}
.qc-card-body pre{margin:.4em 0;padding:7px 9px;border-radius:8px;
  background:var(--dsw-alias-bg-layer-2, #f6f6f6);overflow-x:auto}
.qc-card-body pre code{padding:0;background:none}
.qc-card-body a{color:#3b6fd4;text-decoration:underline}
.qc-card-body strong,.qc-card-body b{font-weight:700}
.qc-card-body em,.qc-card-body i{font-style:italic}
/* KaTeX ships its own layout rules with the transcript's stylesheet; pull in the
   few that matter so a captured formula does not collapse into run-together
   glyphs. The markup already carries the spans, so this only restores shape. */
.qc-card-body .katex{font-size:1.05em;line-height:1.2}
.qc-card-body .katex .base{position:relative;display:inline-block;white-space:nowrap}
.qc-card-body .katex .vlist-t{display:inline-table;table-layout:fixed;
  border-collapse:collapse}
.qc-card-body .katex .vlist-r{display:table-row}
.qc-card-body .katex .vlist{display:table-cell;vertical-align:bottom;position:relative}
.qc-card-body .katex .vlist > span{display:block;height:0;position:relative}
.qc-card-body .katex .vlist > span > span{display:inline-block}
.qc-card-body .katex .msupsub{text-align:left}
.qc-card-body .katex .mfrac > span > span{text-align:center}
.qc-card-body .katex .mfrac .frac-line{border-bottom:1px solid currentColor;
  display:inline-block;width:100%}
.qc-card-body .katex .mord,.qc-card-body .katex .mbin,.qc-card-body .katex .mrel,
.qc-card-body .katex .mopen,.qc-card-body .katex .mclose,.qc-card-body .katex .mpunct,
.qc-card-body .katex .minner{display:inline-block}
.qc-card-body .katex .mspace{display:inline-block}
.qc-card-body .katex .sqrt > .root{margin-left:.2em}
.qc-card-body .katex .hide-tail{overflow:hidden}
.qc-card-body .katex .sizing,.qc-card-body .katex .fontsize-ensurer{display:inline-block}
.qc-card-body table{border-collapse:collapse;width:100%;font-size:12.5px;margin:0}
.qc-card-body td,.qc-card-body th{border:1px solid #e6e6e6;padding:6px 10px;
  text-align:left}
.qc-card-body th{background:#fafafa;font-weight:600}
.qc-card-md{margin:0;white-space:pre-wrap;font:inherit;font-size:12px;line-height:1.55}

.qc-notice{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:70;
  padding:6px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-state-warn-primary);
  font-size:12px;max-width:min(32em,90vw);text-align:center}

.qc-side{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13px;
  color:var(--dsw-alias-label-primary);box-sizing:border-box}
.qc-side-head{display:flex;align-items:center;gap:8px;padding:8px 12px;
  border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.qc-side-head-title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qc-side-head button{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:3px 8px;border-radius:7px;cursor:pointer}
.qc-side-head button:hover{background:var(--dsw-alias-bg-layer-2)}
.qc-quote{flex:none;margin:10px 12px 0;padding:8px 10px;border-left:2px solid var(--dsw-alias-brand-primary);
  border-radius:0 8px 8px 0;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);
  font-size:12px;line-height:1.55}
.qc-quote-label{font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.75;margin-bottom:3px;
  display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.qc-quote-label button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-brand-primary);
  font:inherit;font-size:11px;letter-spacing:0;text-transform:none;cursor:pointer;padding:0;flex:none}
.qc-quote-body{white-space:pre-wrap;word-break:break-word}
.qc-quote-body.qc-clamped{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.qc-thread{flex:1;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.qc-empty{margin:auto;max-width:30em;text-align:center;color:var(--dsw-alias-label-secondary);
  font-size:12.5px;line-height:1.65}
.qc-msg{display:flex;flex-direction:column;gap:4px;max-width:100%}
.qc-msg-role{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);opacity:.75}
.qc-msg-body{white-space:pre-wrap;word-break:break-word;line-height:1.7}
.qc-msg-user .qc-msg-body{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);
  border-radius:9px;padding:7px 10px}
.qc-msg-actions{display:flex;gap:10px}
.qc-msg-actions button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-brand-primary);
  font:inherit;font-size:12px;cursor:pointer;padding:0}
.qc-msg-actions button:hover{text-decoration:underline}
.qc-msg-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.6}
.qc-dots::after{content:'';animation:qc-dots 1.2s steps(4,end) infinite}
@keyframes qc-dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
.qc-side-compose{flex:none;border-top:1px solid var(--dsw-alias-border-l1);padding:10px 12px;
  display:flex;flex-direction:column;gap:8px}
.qc-side-compose textarea{width:100%;box-sizing:border-box;resize:none;min-height:3.4em;max-height:12em;
  font:inherit;line-height:1.5;padding:8px 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);outline:none}
.qc-side-compose textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.qc-side-compose-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.qc-side-compose-hint{flex:1;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.85}
.qc-btn{appearance:none;border:0;border-radius:8px;font:inherit;font-size:12.5px;padding:6px 14px;
  cursor:pointer;background:var(--dsw-alias-brand-primary);color:#fff;font-weight:500}
.qc-btn:disabled{opacity:.45;cursor:default}
.qc-btn-ghost{background:transparent;color:var(--dsw-alias-label-secondary);
  border:1px solid var(--dsw-alias-border-l2);font-weight:400}
.qc-btn-ghost:hover{background:var(--dsw-alias-bg-layer-2)}
`


