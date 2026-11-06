/**
 * Contact sheet: every design state in one image, for review.
 *
 * A baseline directory is nine separate PNGs, which is the right format for a diff and the wrong format for a human.
 * This stitches them into one labelled grid so a design can be judged in a single look - the step that was missing
 * when the chip's two blues were found by hand.
 *
 * The crop is deliberate. Each capture is 900x220 CSS px with the composer line near the top; showing the whole frame
 * would waste most of the sheet on empty background.
 *
 * Usage: node tools/design-sheet.mjs [--dir design/baseline] [--out design/sheet.png]
 */
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { CHIP_STATES } from '../design/fixture.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** Read `--flag value` from argv, or fall back. */
const flag = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 || process.argv[index + 1] === undefined ? fallback : process.argv[index + 1]
}

const dir = resolve(root, flag('dir', 'design/baseline'))
const out = resolve(root, flag('out', 'design/sheet.png'))

/** The notes live with the states, so the sheet cannot describe a state differently from the fixture. */
const noteOf = (name) => CHIP_STATES.find((state) => `${state.name}.png` === name)?.note ?? ''

const files = (await readdir(dir)).filter((name) => name.endsWith('.png')).sort()
if (files.length === 0) {
  console.error(`no PNGs in ${dir}; run \`npm run design:update\` first`)
  process.exit(2)
}

const images = []
for (const name of files) {
  const bytes = await readFile(join(dir, name))
  images.push({
    name: basename(name, '.png'),
    note: noteOf(name),
    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
  })
}

// Two columns, because each capture is 900 CSS px wide and the interesting band is only ~50px tall.
const COLUMNS = 2
const CELL_WIDTH = 900
// The composer line sits around y=30 in the capture; show a little above and below it.
const CROP_TOP = 20
const CROP_HEIGHT = 56
const LABEL_HEIGHT = 26

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: COLUMNS * CELL_WIDTH, height: 400 }, deviceScaleFactor: 2 })
try {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6f7f9; font: 13px/1.4 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
    .grid { display: grid; grid-template-columns: repeat(${COLUMNS}, ${CELL_WIDTH}px); }
    figure { margin: 0; padding: 10px 12px 14px; border-right: 1px solid #e3e5e9; border-bottom: 1px solid #e3e5e9; }
    figcaption { height: ${LABEL_HEIGHT}px; display: flex; align-items: baseline; gap: 8px; }
    .name { font-weight: 600; color: #0f1115; font-variant-numeric: tabular-nums; }
    .note { color: #6b7280; }
    canvas { display: block; width: ${CELL_WIDTH}px; height: ${CROP_HEIGHT}px; background: #fff; border-radius: 6px; }
  </style></head><body><div class="grid" id="grid"></div></body></html>`)

  await page.evaluate(async (payload) => {
    const grid = document.getElementById('grid')
    for (const item of payload.images) {
      const figure = document.createElement('figure')
      const caption = document.createElement('figcaption')
      const name = document.createElement('span')
      name.className = 'name'
      name.textContent = item.name
      const note = document.createElement('span')
      note.className = 'note'
      note.textContent = item.note
      caption.append(name, note)
      const canvas = document.createElement('canvas')
      figure.append(caption, canvas)
      grid.append(figure)

      const image = new Image()
      image.src = item.dataUrl
      await image.decode()
      // The capture is at deviceScaleFactor 2, so device pixels are twice the CSS pixels the sheet is laid out in.
      const ratio = image.width / payload.cellWidth
      canvas.width = payload.cellWidth * 2
      canvas.height = payload.cropHeight * 2
      canvas.style.width = `${payload.cellWidth}px`
      canvas.style.height = `${payload.cropHeight}px`
      const context = canvas.getContext('2d')
      context.drawImage(
        image,
        0, payload.cropTop * ratio, image.width, payload.cropHeight * ratio,
        0, 0, canvas.width, canvas.height,
      )
    }
  }, { images, cellWidth: CELL_WIDTH, cropTop: CROP_TOP, cropHeight: CROP_HEIGHT })

  await page.waitForTimeout(200)
  await mkdir(dirname(out), { recursive: true })
  await page.screenshot({ path: out, fullPage: true })
  console.log(`sheet: ${out}  (${images.length} states, ${COLUMNS} columns)`)
} finally {
  await browser.close()
}
