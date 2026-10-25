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
check('the bubble hugs the column edge',
  /column\.right \+ 4/.test(source), 'the bubble is not tight against the column')
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
check('the bubble is absolutely positioned inside the container',
  /\.qc-marker\{position:absolute/.test(css),
  'a fixed bubble cannot be clipped by the container overflow')
check('the bubble has a small z-index',
  (() => { const m = /z-index:(\d+)/.exec(markerRule); return m !== null && Number(m[1]) < 100 }),
  'the bubble still uses a chrome-beating z-index')
check('bubbles mount into the scroll container',
  /const scroller = scrollContainerOf\(flow\)/.test(source)
    && /setHost\(/.test(source)
    && /\n\s*host,\n/.test(source),
  'the bubbles are still portaled to body')
check('the container is made a positioned ancestor',
  /scroller\.style\.position = 'relative'/.test(source),
  'absolute children have no offset parent')
check('bubble coordinates are container-relative',
  /topInScroller = rect\.top - origin\.top \+ scroller\.scrollTop/.test(source),
  'bubble coordinates are viewport-relative')

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
check('the ResizeObserver tracks without a debounce',
  /new ResizeObserver\(schedule\)/.test(source),
  'the bubble lags the column while dragging')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
