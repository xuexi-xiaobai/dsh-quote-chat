/**
 * The two toolbar glyphs are one visual system, and they come from a third party.
 *
 * Issue #15 was not about weight — the old pair landed on 1.14px effective stroke and Lucide at the same
 * 14px lands on 1.17px, so nothing here is a thickness change. It was about composition: the plus hung
 * OUTSIDE the bubble, its strokes crossed the bubble's own outline, and at 14px the two merged. The old
 * pair also spoke two dialects at once — one icon was "a shape plus an attached symbol", the other was
 * "two shapes meeting at a tangent" — and the plus carried its own `opacity:.7` under the stylesheet's
 * `opacity:.8`, so the mark actually drawn was 0.56.
 *
 * The pair is now `message-square-plus` and `panel-right` from Lucide (ISC). What would regress silently
 * is the thing that made them a set: one grid, one stroke, one join. So the checks below pin the shared
 * geometry, forbid per-path overrides, and pin the exact upstream paths so a future hand-edit cannot
 * drift away from the licensed original without someone noticing.
 *
 * Run: node test/icons.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'src', 'icons.js'), 'utf8')
const notices = await readFile(join(here, '..', 'docs', 'third-party-notices.md'), 'utf8')

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** The body of one exported icon, from its opening brace to the closing one at column zero. */
const bodyOf = (name) => new RegExp(`export function ${name}\\(\\) \\{([\\s\\S]*?)\\n\\}`).exec(source)?.[1] ?? ''

const annotate = bodyOf('IconAnnotate')
const sideChat = bodyOf('IconSideChat')
const confirm = bodyOf('IconCheck')

check('both glyphs are still where the test expects them',
  annotate.length > 0 && sideChat.length > 0,
  'an icon body was not found; the checks below would pass vacuously')

// ── One grid, one stroke: the pair is a set ──────────────────────────────
const geometry = /const LUCIDE = \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''

check('the shared geometry is declared once',
  geometry.length > 0, 'no LUCIDE object; the two icons would carry their own literals and drift apart')

check('the shared geometry is the 24 grid Lucide draws on',
  /viewBox: '0 0 24 24'/.test(geometry),
  'the viewBox is not Lucide\'s; the paths below would be scaled differently')

check('the shared geometry is one stroke weight',
  /'stroke-width': 2/.test(geometry), 'the stroke weight is not the one Lucide draws')

check('both icons spread the shared geometry instead of writing their own',
  /\.\.\.LUCIDE/.test(annotate) && /\.\.\.LUCIDE/.test(sideChat),
  'an icon declares its own viewBox/stroke, so the pair can drift')

check('both icons draw at the toolbar size',
  /width: 14, height: 14/.test(annotate) && /width: 14, height: 14/.test(sideChat),
  'an icon draws at a different size than the button expects')

check('no path overrides the stroke weight',
  !/stroke-width/.test(annotate) && !/stroke-width/.test(sideChat),
  'a per-path stroke-width re-introduces the mixed-weight pair this replaced')

check('no path carries its own opacity',
  !/opacity/.test(annotate) && !/opacity/.test(sideChat),
  'a per-path opacity multiplies with the stylesheet\'s .8 and greys the mark out (was 0.56)')

// ── The upstream paths, unmodified ───────────────────────────────────────
check('the annotate bubble is Lucide\'s message-square-plus bubble',
  annotate.includes('M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z'),
  'the bubble was hand-edited; re-check it against the licensed original')

check('the plus is drawn inside the bubble',
  annotate.includes("'M12 8v6'") && annotate.includes("'M9 11h6'"),
  'the plus moved; it was hanging outside the outline and colliding with it at 14px')

check('the side chat glyph is Lucide\'s panel-right',
  sideChat.includes('x: 3, y: 3, width: 18, height: 18, rx: 2') && sideChat.includes("'M15 3v18'"),
  'the panel was hand-edited; re-check it against the licensed original')

// ── The swap did not leak into the other glyph ───────────────────────────
check('the confirm glyph keeps its own 16 grid',
  /viewBox: '0 0 16 16'/.test(confirm) && !/\.\.\.LUCIDE/.test(confirm),
  'the confirm glyph was dragged onto the 24 grid; it is hand-drawn and sized for the 16 one')

// ── Provenance survives a future edit ────────────────────────────────────
check('the source names the upstream project',
  /lucide/i.test(source), 'nothing points at Lucide, so the next editor has no reason to keep the paths intact')

check('the source points at the notices file',
  /third-party-notices/.test(source), 'the ISC notice is not referenced from the file that uses the paths')

check('the notices file carries the ISC notice and both glyph names',
  /ISC License/.test(notices) && /message-square-plus/.test(notices) && /panel-right/.test(notices),
  'the licence text or the glyph list is missing from docs/third-party-notices.md')

// ── Report ───────────────────────────────────────────────────────────────
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok || item.detail === '' ? '' : `\n      ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
