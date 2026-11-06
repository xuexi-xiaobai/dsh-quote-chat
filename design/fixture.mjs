/**
 * The design fixture: a faithful, static replica of the composer's chip, for visual review.
 *
 * WHY A REPLICA AND NOT THE REAL APP
 *
 * The chip is not one of this plugin's React components. It is the HOST's Lexical decorator, styled entirely by
 * `src/stylesheet.js`. Reviewing its design therefore needs the host's DOM shape plus our stylesheet - not a login, a
 * conversation, a virtualised transcript and a 6-9s browser launch. A replica makes the state identical on every run,
 * which is the precondition for comparing screenshots at all.
 *
 * The cost of a replica is drift: if the host changes its decorator, this file silently stops representing the
 * product. `tools/design-parity.mjs` guards that by reading the real chip's structure and comparing it with this one.
 *
 * WHAT IS MEASURED, NOT GUESSED
 *
 * Everything below was read from the running app on 2026-11-07 (see `tools/design-dump-chip.mjs` and
 * `tools/design-dump-type.mjs`):
 *
 *   chip element    span[data-composer-chip="quote-chat"][contenteditable="false"][data-lexical-decorator="true"]
 *                   + data-qc-num / -kind / -label / -ref
 *   chip subtree    > span > ( span marker "@", span label "注释 N" )
 *   chip metrics    81.05 x 21.3 px, padding 0 7.5px, margin 0 4.5px, radius 999px
 *   ::before        16.797 x 16.797 px, margin-right 4.8px  (the kind glyph)
 *   ::after         content from data-qc-label
 *   composer        font 15px / line-height 25px, padding 4px 8px 0 14px, colour rgb(15,17,21), surface #fff
 *   font stack      -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", ...
 *
 * The host's class names are CSS-module hashes. They are reproduced here only for fidelity: the stylesheet selects
 * STRUCTURALLY (`> span > span:first-child`), so a host rename does not break the chip. The parity check compares
 * structure and attribute names, never class names.
 */

/** The composer's typography, as measured in the running app. */
export const COMPOSER = {
  width: 668,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", '
    + '"Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: '15px',
  lineHeight: '25px',
  padding: '4px 8px 0 14px',
  ink: 'rgb(15, 17, 21)',
  surface: '#fff',
}

/** The host's decorator class names, as observed. Opaque to us; kept so the replica looks like the real thing. */
const HOST_CLASSES = {
  wrapper: 'q44v1G_reference yAWgPa_chip',
  marker: 'yAWgPa_marker',
  label: 'yAWgPa_label',
}

/**
 * One chip, exactly as the host renders it.
 *
 * @param options - `{ num, label, kind, ref, hovered }`.
 * @returns the chip's HTML.
 */
export function chip(options = {}) {
  const num = options.num ?? 1
  const label = options.label ?? `注释 ${num}`
  const kind = options.kind ?? 'text'
  const ref = options.ref ?? `qc-fixture-${num}`
  const hovered = options.hovered === true
  return '<span data-composer-chip="quote-chat" contenteditable="false" data-lexical-decorator="true"'
    + ` data-qc-num="${num}" data-qc-kind="${kind}" data-qc-label="${label}" data-qc-ref="${ref}"`
    + (hovered ? ' data-qc-hover="1"' : '')
    + '>'
    + `<span class="${HOST_CLASSES.wrapper}" title="${label}">`
    + `<span class="${HOST_CLASSES.marker}" aria-hidden="true">@</span>`
    + `<span class="${HOST_CLASSES.label}">${label}</span>`
    + '</span>'
    + '</span>'
}

/**
 * The removal control, exactly as `ChipCards` renders it.
 *
 * It is a portal into `document.body`, positioned from the chip's live rectangle through three custom properties.
 * The fixture reproduces the markup and computes those properties after layout, which is what the component does.
 *
 * @param options - `{ label }`.
 * @returns the button's HTML.
 */
export function chipRemove(options = {}) {
  const label = options.label ?? '删除'
  return '<button type="button" class="qc-chip-remove"'
    + ` title="${label}" aria-label="${label}" data-qc-fixture-remove="1">`
    + '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">'
    + '<path d="M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4"/>'
    + '</svg>'
    + '</button>'
}

/**
 * The page shell: composer typography, a stage, and the script that places the × overlay.
 *
 * @param body - the composer's inner HTML.
 * @param options - `{ dark, remove }`.
 * @returns a complete HTML document.
 */
export function page(body, options = {}) {
  const dark = options.dark === true
  const remove = options.remove === true
  return `<!doctype html>
<html lang="zh-CN"${dark ? ' style="color-scheme: dark"' : ' style="color-scheme: light"'}>
<head>
<meta charset="utf-8">
<title>quote-chat design fixture</title>
<style>
  html, body { margin: 0; padding: 0; }
  body {
    background: ${dark ? '#101114' : COMPOSER.surface};
    font-family: ${COMPOSER.fontFamily};
    -webkit-font-smoothing: antialiased;
  }
  .qc-stage { padding: 28px 24px; }
  /* The host's composer, reduced to the properties the chip inherits or resolves against. */
  .qc-composer {
    box-sizing: border-box;
    width: ${COMPOSER.width}px;
    padding: ${COMPOSER.padding};
    font-family: ${COMPOSER.fontFamily};
    font-size: ${COMPOSER.fontSize};
    line-height: ${COMPOSER.lineHeight};
    color: ${dark ? 'rgb(231, 233, 238)' : COMPOSER.ink};
    background: ${dark ? '#1b1d21' : COMPOSER.surface};
    border-radius: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    outline: none;
  }
  .qc-composer p { margin: 0; }
</style>
</head>
<body>
<div class="qc-stage">
  <div class="qc-composer" contenteditable="true" role="textbox" aria-multiline="true"
       aria-label="发消息或创建任务">${body}</div>
</div>
${remove ? chipRemove() : ''}
<script>
  // Place the × overlay from the chip's live rectangle, exactly as ChipCards does with its custom properties.
  (() => {
    const remove = document.querySelector('[data-qc-fixture-remove]')
    const chip = document.querySelector('[data-composer-chip="quote-chat"]')
    if (remove === null || chip === null) return
    const box = chip.getBoundingClientRect()
    remove.style.setProperty('--qc-chip-left', box.left + 'px')
    remove.style.setProperty('--qc-chip-top', box.top + 'px')
    remove.style.setProperty('--qc-chip-height', box.height + 'px')
  })()
</script>
</body>
</html>`
}

/** Move the pointer onto the chip's centre. */
const hoverChip = async (page) => {
  const point = await page.evaluate(() => {
    const chip = document.querySelector('[data-composer-chip="quote-chat"]')
    const box = chip.getBoundingClientRect()
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
  })
  await page.mouse.move(point.x, point.y)
}

/** Move the pointer onto the × overlay. */
const hoverRemove = async (page) => {
  const point = await page.evaluate(() => {
    const remove = document.querySelector('[data-qc-fixture-remove]')
    const box = remove.getBoundingClientRect()
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
  })
  await page.mouse.move(point.x, point.y)
}

/** Park the pointer far away, so no `:hover` state leaks into a resting capture. */
const parkPointer = async (page) => { await page.mouse.move(1, 1) }

const PROSE_BEFORE = '请比较'
const PROSE_AFTER = '这两段，重点看结论。'

/**
 * The states under review.
 *
 * Each one is a full page description plus, when the state involves the pointer, the movement that produces it.
 * `dark` is handled by the Playwright project's `colorScheme`, which is what the stylesheet's media query reads.
 */
export const CHIP_STATES = [
  {
    name: 'chip-rest',
    note: '一颗芯片，指针在远处',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1 })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-hover',
    note: '指针在芯片上：类型图标被 × 替换',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, hovered: true })}${PROSE_AFTER}</p>`,
      { remove: true }),
    act: hoverChip,
  },
  {
    name: 'chip-remove-hover',
    note: '指针在 × 上：描边变红',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, hovered: true })}${PROSE_AFTER}</p>`,
      { remove: true }),
    act: hoverRemove,
  },
  {
    name: 'chip-table',
    note: '表格注释：网格图标',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, kind: 'table' })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-ordinal-10',
    note: '两位数序号：宽度是否仍均匀',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 10 })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-pair',
    note: '两颗芯片并排：是否像同一个组件',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1 })}${chip({ num: 2 })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-pair-hover-first',
    note: '并排时悬停第一颗：与第二颗的对比',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, hovered: true })}${chip({ num: 2 })}${PROSE_AFTER}</p>`,
      { remove: true }),
    act: hoverChip,
  },
  {
    name: 'chip-dark',
    note: '暗色：芯片自己的调色板',
    dark: true,
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1 })}${PROSE_AFTER}</p>`, { dark: true }),
    act: parkPointer,
  },
  {
    name: 'chip-dark-hover',
    note: '暗色 + 悬停',
    dark: true,
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, hovered: true })}${PROSE_AFTER}</p>`,
      { dark: true, remove: true }),
    act: hoverChip,
  },
]
