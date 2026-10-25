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
  /onDelete: \(\) => \{[\s\S]{0,80}onRemove\(annotation\)/.test(source),
  'the editor cannot delete')
check('the editor closes on Escape and on an outside press',
  /event\.key === 'Escape'/.test(source) && /addEventListener\('mousedown', onDown, true\)/.test(source),
  'the editor cannot be dismissed')
// The user asked for a bubble click to OPEN THE EDITOR. Jumping moved into the
// panel (and stays available on the chip), so one click is not asked to do both.
check('a bubble click opens the editor',
  /onClick: \(\) => \{[\s\S]{0,140}setEditing\(\{/.test(source),
  'a bubble click does not open the editor')
check('jumping is available from the panel',
  /className: 'qc-bp-jump'/.test(source) && /onClick: onJump/.test(source),
  'the panel offers no way to jump')
check('a chip click still jumps',
  /actionsRef\.current\.onJump\(annotation\)/.test(source),
  'clicking a chip no longer jumps')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
