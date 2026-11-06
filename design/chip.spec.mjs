/**
 * The chip's design, captured state by state.
 *
 * Every state is rendered from `design/fixture.mjs` and compared against a committed baseline. A design change that
 * nobody asked for shows up as a diff; a design change that was asked for is accepted with
 * `npx playwright test --update-snapshots`.
 *
 * The stylesheet is imported from `src/`, not from the built bundle: the workbench must review the source that will be
 * shipped, and `node build.mjs --check` already guarantees the bundle matches it.
 *
 * Run:  npx playwright test
 *       npx playwright test --update-snapshots
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { STYLESHEET } from '../src/stylesheet.js'
import { CHIP_STATES } from './fixture.mjs'

/**
 * Render one state and wait until it is stable enough to photograph.
 *
 * `document.fonts.ready` is awaited because a capture taken before the CJK fallback resolves renders in a different
 * face, which would show up as a whole-line diff rather than as a design change.
 */
const render = async (page, state) => {
  await page.emulateMedia({ colorScheme: state.dark === true ? 'dark' : 'light' })
  await page.setContent(state.html(), { waitUntil: 'load' })
  await page.addStyleTag({ content: STYLESHEET })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(80)
  await state.act(page)
  // One frame for the hover transition (.12s) to land, plus a margin.
  await page.waitForTimeout(220)
}

for (const state of CHIP_STATES) {
  test(`chip design: ${state.name}`, async ({ page }) => {
    await render(page, state)
    await expect(page).toHaveScreenshot(`${state.name}.png`)
  })
}

/**
 * The measurements a screenshot cannot express.
 *
 * These are the checks that would have caught the two problems found by hand on 2026-11-06: the chip drawing its kind
 * glyph in one blue and its label in another, and the × painting a body of its own instead of letting the pill show
 * through.
 */
test('chip metrics: the palette is one family, not two blues', async ({ page }) => {
  // KNOWN DEFECT, recorded rather than silenced. Measured 2026-11-07: the kind glyph resolves to rgb(65,118,230)
  // (the raw accent) while the label resolves to rgb(54,96,184) (the accent pressed toward the page ink) - a channel
  // distance of 46. On screen that is two blues inside one pill, and it is why the hovered chip looks like a
  // different component from the one beside it.
  //
  // `test.fail()` keeps the suite green while the defect is open, and turns into "unexpectedly passed" the moment
  // somebody fixes it - which is the prompt to delete this line.
  test.fail(true, 'the chip draws its glyph and its label in two different blues (channel distance 46)')
  await render(page, CHIP_STATES[0])
  const palette = await page.evaluate(() => {
    const chip = document.querySelector('[data-composer-chip="quote-chat"]')
    const read = (value) => {
      // `color(srgb r g b / a)` and `rgb(r, g, b)` both end up as three 0-255 channels.
      const srgb = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(value)
      if (srgb !== null) {
        return srgb.slice(1, 4).map((channel) => Math.round(Number(channel) * 255))
      }
      const rgb = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(value)
      return rgb === null ? null : rgb.slice(1, 4).map((channel) => Math.round(Number(channel)))
    }
    const style = getComputedStyle(chip)
    const before = getComputedStyle(chip, '::before')
    return {
      glyph: read(before.backgroundColor),
      label: read(style.color),
      chipSurface: read(style.backgroundColor),
      border: read(style.borderTopColor),
    }
  })

  expect(palette.glyph, 'the kind glyph must resolve to a colour').not.toBeNull()
  expect(palette.label, 'the label must resolve to a colour').not.toBeNull()

  // The glyph and the label are the same ink at two weights: the glyph is the accent, the label is the accent pressed
  // toward the page ink. They must stay in one hue family - a channel spread this small is what "one family" means
  // numerically, and it is what the two-blues revision violated.
  const distance = Math.max(...palette.glyph.map((channel, index) => Math.abs(channel - palette.label[index])))
  expect(distance, `glyph ${JSON.stringify(palette.glyph)} vs label ${JSON.stringify(palette.label)}`)
    .toBeLessThanOrEqual(40)
})

test('chip metrics: the remove control paints no body of its own', async ({ page }) => {
  // KNOWN DEFECT, recorded rather than silenced. Measured 2026-11-07: the × is 20.4 x 20.4 CSS px, under the
  // 24 x 24 WCAG 2.2 AA minimum for a pointer target. It is 1.36em against a 15px font, so the size is inherited
  // from a typographic choice rather than from a target-size requirement.
  test.fail(true, 'the × is 20.4px square, under the 24px WCAG 2.2 AA pointer target')
  await render(page, CHIP_STATES[1])
  const remove = await page.evaluate(() => {
    const button = document.querySelector('.qc-chip-remove')
    if (button === null) return null
    const style = getComputedStyle(button)
    const box = button.getBoundingClientRect()
    return {
      background: style.backgroundColor,
      boxShadow: style.boxShadow,
      width: Math.round(box.width * 10) / 10,
      height: Math.round(box.height * 10) / 10,
    }
  })
  expect(remove, 'the × must be mounted in the hover state').not.toBeNull()
  // A filled disc or a surface-coloured ring is what made the control read as a badge pasted onto the pill.
  expect(remove.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  expect(remove.boxShadow).toBe('none')
  // WCAG 2.2 AA target size for a pointer target.
  expect(remove.width).toBeGreaterThanOrEqual(24)
  expect(remove.height).toBeGreaterThanOrEqual(24)
})

test('chip metrics: the chip fits its line and never clips its label', async ({ page }) => {
  await render(page, CHIP_STATES[4])
  const geometry = await page.evaluate(() => {
    const chip = document.querySelector('[data-composer-chip="quote-chat"]')
    const paragraph = chip.closest('p')
    const box = chip.getBoundingClientRect()
    const lineHeight = Number.parseFloat(getComputedStyle(paragraph).lineHeight)
    const label = getComputedStyle(chip, '::after')
    return {
      chipHeight: Math.round(box.height * 10) / 10,
      lineHeight,
      labelText: label.content,
      // A label wider than the pill means the ordinal was squeezed into an ellipsis.
      overflow: chip.scrollWidth - chip.clientWidth,
    }
  })
  expect(geometry.chipHeight).toBeLessThanOrEqual(geometry.lineHeight + 1)
  expect(geometry.overflow).toBeLessThanOrEqual(1)
  expect(geometry.labelText).toContain('10')
})

/**
 * Accessibility.
 *
 * The chip is a decorator inside a text field, so axe is run on the whole fixture rather than on the chip alone: a
 * chip that is fine in isolation can still break the field's own labelling.
 */
test('chip a11y: the fixture has no serious violations', async ({ page }) => {
  await render(page, CHIP_STATES[0])
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const serious = results.violations.filter((violation) =>
    violation.impact === 'serious' || violation.impact === 'critical')
  expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
})
