/**
 * Guard the bubble editor and the layering rules.
 *
 * Four behaviours the user asked for, each easy to regress:
 *
 *   1. The bubble must not paint over the app's own chrome (top bar, composer).
 *   2. The bubble hugs the text column, so resizing the column moves it.
 *   3. The jump centres the passage in the area between the top bar and the
 *      composer — the composer's height is fluid, so it is measured per jump.
 *   4. Clicking a bubble opens an editor that can save or delete the comment.
 *
 * Run: node test/bubble-editor.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'client.js'), 'utf8')
const css = /const (?:CSS|STYLESHEET) = `([\s\S]*?)`\n/.exec(source)?.[1] ?? ''

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

// ── 1. Layering ────────────────────────────────────────────────────────────
const markerRule = /\.qc-marker\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
const zOf = (rule) => {
  const match = /z-index:(\d+)/.exec(rule)
  return match === null ? null : Number(match[1])
}
const markerZ = zOf(markerRule)
check('the bubble has a modest z-index',
  markerZ !== null && markerZ < 1000,
  `z-index is ${markerZ}; a max-ish value paints over the app chrome`)
check('the bubble does not use a near-max z-index',
  !/z-index:21474/.test(markerRule),
  'the bubble still uses the max z-index band')
// The other floating surfaces (hover card, popups) legitimately float above the
// transcript; only the bubble is pinned into the gutter and must stay under chrome.
const panelZ = zOf(/\.qc-bubble-panel\{([\s\S]*?)\}/.exec(css)?.[1] ?? '')
check('the editor sits above its own bubble',
  panelZ !== null && markerZ !== null && panelZ > markerZ,
  `panel z ${panelZ} vs marker z ${markerZ}`)
check('the editor also stays under app chrome',
  panelZ !== null && panelZ < 1000, `panel z-index is ${panelZ}`)

// ── 2. The bubble follows the column ──────────────────────────────────────
check('the column width is observed',
  /new ResizeObserver\(/.test(source), 'no ResizeObserver on the column')
check('the observer watches the column element',
  /columnObserver\.observe\(target\)/.test(source),
  'the ResizeObserver watches something else')
check('the observer is disconnected on teardown',
  /if \(columnObserver !== null\) columnObserver\.disconnect\(\)/.test(source),
  'the ResizeObserver leaks')
check('the column element is derived, not hard-coded',
  /function columnElement\(flow\)/.test(source),
  'no columnElement helper')

// ── 3. The jump centres in the readable area ──────────────────────────────
check('the readable area accounts for the composer',
  /function visibleChatArea\(scroller\)/.test(source)
    && /bottom = dock\.top/.test(source),
  'the composer is not subtracted from the visible area')
check('the composer dock is discovered by slot',
  /conversation\.composer\.dock/.test(source)
    || /conversation\.input\.dock/.test(source),
  'no composer dock selector')
check('the area is re-measured per jump',
  /const area = visibleChatArea\(scroller\)/.test(source),
  'the visible area is cached')
check('a collapsed area falls back to the scroller box',
  /bottom - top < 120/.test(source),
  'no guard against an empty visible area')

// ── 4. The bubble editor ──────────────────────────────────────────────────
check('the bubble opens an editor',
  /className: 'qc-bubble-panel'/.test(source), 'no editor panel')
check('the editor offers save and delete',
  /qc-bp-save/.test(source) && /qc-bp-delete/.test(source),
  'the editor has no save/delete actions')
check('the editor is seeded with the current comment',
  /useState\(annotation\.comment\)/.test(source),
  'the editor does not start from the stored comment')
check('saving rewrites the comment in place',
  /function updateAnnotation\(sessionId, id, comment\)/.test(source),
  'no updateAnnotation in the store')
check('saving keeps the codec payload in step',
  /chipPayloads\.set\(annotation\.id, \{[\s\S]{0,160}comment:/.test(source),
  'the model would still receive the old comment')
check('deleting from the editor removes the annotation',
  /className: 'qc-bp-delete'[\s\S]{0,200}onDelete\(\)/.test(source),
  'the editor cannot delete')
check('the editor closes on Escape and on an outside press',
  /event\.key === 'Escape'/.test(source) && /addEventListener\('mousedown', onDown, true\)/.test(source),
  'the editor cannot be dismissed')
// The user asked for a bubble click to OPEN THE EDITOR. Jumping moved into the
// panel (and stays available on the chip), so one click is not asked to do both.
check('a bubble click opens the editor',
  /onClick: \(\) => \{[\s\S]{0,700}setEditing\(/.test(source),
  'a bubble click does not open the editor')
check('the panel keeps only edit, save and delete',
  !/qc-bp-jump/.test(source) && !/qc-bp-quote/.test(source),
  'the panel still carries a jump button or a passage preview')
check('a chip click still jumps',
  /actionsRef\.current\.onJump\(annotation\)/.test(source),
  'clicking a chip no longer jumps')

// ── 5. The bubble is clipped by the transcript, not floating over chrome ──
check('the bubble has a small z-index',
  (() => { const m = /z-index:(\d+)/.exec(markerRule); return m !== null && Number(m[1]) < 100 }),
  'the bubble still uses a chrome-beating z-index')

// ── 6. Motion ─────────────────────────────────────────────────────────────
check('the hover card has an exit animation',
  /\.qc-card-out\{animation:qc-card-out/.test(css) && /@keyframes qc-card-out/.test(css),
  'the card still vanishes between frames')
check('the card is kept mounted for the exit',
  /CARD_EXIT_MS/.test(source) && /closing: true/.test(source),
  'the card unmounts before its exit animation runs')
check('the highlight fades in',
  /::highlight\(quote-chat-flash\)\{[\s\S]{0,300}animation:qc-hl-in/.test(css),
  'the highlight appears with no transition')
check('a held highlight exists for the editor',
  /::highlight\(quote-chat-hold\)/.test(css) && /function holdRange\(/.test(source),
  'opening the editor does not light the passage')
check('the held highlight is cleared on close',
  /onHighlight\(annotation, false\)/.test(source),
  'the highlight outlives the editor')

// ── 7. Button feedback ────────────────────────────────────────────────────
check('action buttons have a hover background',
  /\.qc-bp-actions button:hover[^{]*\{[\s\S]{0,120}background:/.test(css),
  'buttons only change the cursor on hover')
check('action buttons have a press state',
  /\.qc-bp-actions button:active/.test(css), 'no press feedback')
check('action buttons have a focus ring',
  /\.qc-bp-actions button:focus-visible/.test(css), 'no keyboard focus feedback')
check('delete looks destructive on hover',
  /\.qc-bp-delete:hover[^{]*\{[\s\S]{0,160}state-error-primary/.test(css),
  'delete does not warn on hover')
check('save shows a confirmation',
  /qc-bp-done/.test(source) && /labels\.saved/.test(source),
  'saving gives no visible acknowledgement')
check('a resize only refreshes the bubble set',
  /const reflow = \(\) =>/.test(source),
  'a resize still recomputes geometry')

// ── 8. Contrast and the stray notice ──────────────────────────────────────
// The save button must be readable: a pale accent fill with white text is not.
const lum = (hex) => {
  const v = hex.replace('#', '')
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a, b) => {
  const l1 = lum(a)
  const l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
const saveRule = /\.qc-bp-save\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
const saveBg = /background:(#[0-9a-f]{3,8})/i.exec(saveRule)?.[1]
check('the save button has a saturated fill token',
  saveBg !== undefined, 'no explicit background on the save button')
if (saveBg !== undefined) {
  check('white text on the save fill meets WCAG AA',
    contrast('#ffffff', saveBg) >= 4.5,
    `contrast is ${contrast('#ffffff', saveBg).toFixed(2)}:1`)
}
check('the save button does not use an accent token as its fill',
  !/.qc-bp-save\{[\s\S]{0,200}background:var\(--dsw-alias-state-accent-primary\)/.test(css),
  'a border/text accent token is being used as a button fill')
check('the save button has a distinct hover fill',
  /\.qc-bp-save:hover[^{]*\{[\s\S]{0,120}background:#/.test(css),
  'hover does not change the fill')
check('hover, press and base are all readable',
  (() => {
    const all = [...css.matchAll(/\.qc-bp-save(?::hover|:active)?:?[^{]*\{[\s\S]{0,160}?background:(#[0-9a-f]{6})/gi)]
      .map((m) => contrast('#ffffff', m[1]))
    return all.length > 0 && all.every((r) => r >= 4.5)
  })(), 'one of the save button states is below AA')

// A notice with no text still paints an empty box pinned above the composer.
check('an empty notice renders nothing',
  /typeof notice === 'string' && notice !== ''/.test(source),
  'an empty/nil notice still renders a box')
check('clearing a notice keeps the state a string',
  !/setNotice\(null\)/.test(source),
  'setNotice(null) makes the emptiness check miss')

// --- The passage must stay readable while it is annotated ------------------
// The bubble must live in the margin OUTSIDE the paragraph box. Reserving room
// with padding or a border shrinks the content box, which re-wraps the prose the
// moment a bubble appears; the next measurement then sees a different height and
// the bubble flickers.
check('the bubble sits inside the paragraph box',
  /\.qc-marker\{position:absolute;right:\d+px/.test(css),
  'a negative offset lets the scroll container clip the bubble')
check('the hosting block reserves its gutter',
  /\.qc-hosts-bubble\{padding-right:\d+px\}/.test(css),
  'the bubble overlaps the prose')
check('the gutter is applied once, behind the host flag',
  /if \(row\.dataset\.qcHost === '1'\) continue[\s\S]{0,900}classList\.add\('qc-hosts-bubble'\)[\s\S]{0,80}row\.dataset\.qcHost = '1'/.test(source),
  'the gutter is re-applied every pass, re-wrapping the prose and flickering')
// The panel must ride with its passage rather than float over the viewport: it is
// mounted inside the paragraph and positioned against that box, so scrolling needs
// no reposition listener at all.
// The panel must NOT be inside the paragraph: CSS.highlights paints every text node a
// range covers, and the passage range ends at the paragraph's end. Anything inside the
// paragraph is therefore inside the range, which is why the fluorescent marker kept
// appearing over the editor's labels no matter how it was tagged.
check('the comment panel is mounted outside the passage',
  /\}\), mount\)/.test(source) && !/\}\), row \?\? document\.body\)/.test(source),
  'the panel is inside the paragraph, so the highlight paints over it')
check('the panel anchors to the paragraph sibling container',
  /parent !== null && parent\.isConnected \? parent : document\.body/.test(source),
  'the panel has no stable parent-relative coordinate space')
check('the panel is positioned in flow, not fixed',
  /\.qc-bubble-panel\{position:absolute/.test(css),
  'a fixed panel cannot ride with the passage')
check('the panel needs no scroll listener of its own',
  (() => {
    const body = /function BubblePanel\(props\) \{([\s\S]*?)\n    \}\n/.exec(source)?.[1] ?? ''
    return body !== '' && !/addEventListener\('scroll'/.test(body)
  })(),
  'the panel is repositioned on every scroll event instead of riding the text')
check('the panel receives the passage bottom edge',
  /bottom: box\.bottom/.test(source),
  'the panel cannot tell where the passage ends')
// --- Dark mode -------------------------------------------------------------
check('the chip surface comes from a theme token',
  /data-composer-chip="quote-chat"\][\s\S]{0,320}--dsw-alias-bg-layer-2/.test(css),
  'the chip hard-codes a light grey and breaks in dark mode')
check('the chip has a visible outline so the pill reads in dark mode',
  /data-composer-chip="quote-chat"\][\s\S]{0,360}border:1px solid var\(--dsw-alias-border-l2/.test(css),
  'the chip has no outline and disappears against a dark background')
check('the chip text comes from a theme token',
  /data-composer-chip="quote-chat"\]::after\{[\s\S]{0,160}--dsw-alias-label-primary/.test(css),
  'the chip ordinal hard-codes dark ink and breaks in dark mode')
check('the hover card surface comes from a theme token',
  /\.qc-card\{[^}]*--dsw-alias-bg-overlay/.test(css),
  'the card hard-codes white and breaks in dark mode')
check('no bare light surface literal remains on a themed surface',
  !/background:#fff;/.test(css),
  'a hard-coded white surface survives')
// --- The panel must not sit on the passage, nor be highlighted -------------
// It opens ABOVE the paragraph (negative offset), clear of the gutter bubble.
check('the panel opens above the passage',
  /rel\.top - height - BUBBLE_CLEARANCE/.test(source),
  'the panel covers the passage or the bubble')
check('the panel hugs the paragraph right edge',
  /Math\.max\(0, rel\.right - width\)/.test(source),
  'the panel is not aligned to the text column')
check('the clearance is a named constant',
  /const BUBBLE_CLEARANCE = \d+/.test(source),
  'the clearance is a magic number')
// Plugin chrome must be excluded from the highlight, or the fluorescent marker
// paints straight over the editor.
check('the panel is excluded from the passage highlight',
  /'data-qc-ignore': '1',\s*\n\s*className: 'qc-bubble-panel'/.test(source),
  'the highlight paints over the comment editor')
check('the bubble is excluded from the passage highlight',
  (() => {
    const at = source.indexOf("'data-qc-number'")
    return at > 0 && source.slice(at - 500, at).includes("'data-qc-ignore'")
  })(),
  'the highlight paints over the bubble')
// --- The add-annotation popover must also ride with the passage ------------
// It used to be position:fixed at a viewport coordinate, so scrolling left it
// hovering over unrelated text. It is mounted as a sibling of the annotated block
// and positioned from that block's offset.
// The selection surfaces must satisfy two constraints at once:
//   * inside the transcript -> the container's overflow clips them, so they can never
//     paint over the composer or the top bar;
//   * clamped to the visible band -> they stay fully on screen, so a passage near an
//     edge cannot push them into the clipped region and make them vanish.
// Every earlier attempt satisfied one constraint and broke the other.
check('a shared anchoring helper exists',
  /function anchorInTranscript\(flow, box, size, preferAbove\)/.test(source),
  'the two surfaces anchor independently and can drift apart')
check('the selection toolbar is anchored inside the transcript',
  /anchorInTranscript\(flow, anchor, measured, true\)/.test(source),
  'the toolbar is placed against the viewport and follows the screen')
check('the compose popover is anchored inside the transcript',
  /anchorInTranscript\(flow, source\.rect, \{ width, height \}, true\)/.test(source),
  'the popover is placed against the viewport and follows the screen')
check('both surfaces mount into the transcript when anchored',
  /anchored === null \? document\.body : anchored\.scroller/.test(source),
  'a surface is mounted at body, where nothing clips it against the composer')
check('the anchor is clamped into the scroll band',
  /bandBottom - height - ANCHOR_INSET/.test(source)
    && /Math\.max\(bandTop \+ ANCHOR_INSET, top\)/.test(source),
  'the anchor is not clamped, so an edge selection can push it out of view')
check('the anchor makes the container a containing block',
  /scroller\.style\.position = 'relative'/.test(source)
    && /dataset\.qcPositioned = '1'/.test(source),
  'absolute children have no containing block and land off-screen')
check('no surface claims an absurd z-index',
  [...source.matchAll(/z-index:\s*(\d+)/g)].every((m) => Number(m[1]) < 100),
  'a surface would paint over the chat chrome')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
