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

/**
 * The host's decorator class names, taken from the shipped bundle.
 *
 * They are the CSS-module hashes in `dsh-client-ui-conversation`'s `ReferenceChip.module.css`, read out of
 * `app.asar`. The previous values (`q44v1G_reference yAWgPa_chip`) appear in NO archived file - they were stale, so
 * the host's own rules never applied to this replica and its "the plugin neutralises the host wrapper" claim was never
 * actually exercised. The host's rules are reproduced below for that reason.
 */
const HOST_CLASSES = {
  wrapper: 'M7q97W_chip',
  marker: 'M7q97W_marker',
  label: 'M7q97W_label',
}

/**
 * The host's `ReferenceChip.module.css`, verbatim.
 *
 * The plugin hides the wrapper (`position:absolute; width:0; height:0; overflow:hidden; font-size:0; line-height:0`),
 * so these declarations must not reach the rendered chip. Including them is what proves that: with them present, a
 * regression in the neutralising rule shows up as a changed baseline instead of passing silently.
 */
const HOST_CHIP_CSS = `
.M7q97W_chip{max-width:240px;color:var(--dsw-alias-state-business-primary);user-select:none;
  align-items:baseline;gap:3px;display:inline-flex}
.M7q97W_marker{flex:none;font-weight:500}
.M7q97W_icon{flex:none;align-self:center}
.M7q97W_label{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
`

/**
 * The host's global corner shape, which the fixture was missing.
 *
 * DSH sets `corner-shape: var(--dsw-corner-shape)` on every element and the variable resolves to
 * `superellipse(1.5)`. A superellipse flatter than a circle has a radius of curvature that varies along the curve, so
 * the same `border-radius: 999px` paints a visibly squarer end than a circular arc does. Without this rule the fixture
 * rendered circular corners and disagreed with the app on the one property the review kept pointing at.
 *
 * The plugin opts the chip back out with `corner-shape: round`; this rule is what proves that opt-out is needed and
 * that it works.
 */
const HOST_CORNER_SHAPE = `
*, ::before, ::after { corner-shape: superellipse(1.5); }
`

/**
 * One chip, exactly as the host renders it.
 *
 * `label` is the VISIBLE text, which since the 2026-11-07 review is the opening of the quoted passage rather than
 * `注释 N`; `num` stays because the ordinal still drives the gutter bubbles and the model-facing block.
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
  // A comparison override, not a product state: the stylesheet's radius is 999px (a capsule), and the review asked to
  // see the same chip as a rounded rectangle beside it. Applied inline so the stylesheet stays the single source.
  const radius = options.radius === undefined ? '' : ` style="border-radius:${options.radius}"`
  return '<span data-composer-chip="quote-chat" contenteditable="false" data-lexical-decorator="true"'
    + ` data-qc-num="${num}" data-qc-kind="${kind}" data-qc-label="${label}" data-qc-ref="${ref}"`
    + (hovered ? ' data-qc-hover="1"' : '')
    + radius
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
  /* The host's own chip rules, so the replica is subject to them exactly as the real chip is. */
  ${HOST_CHIP_CSS}
  /* The host's global corner shape. */
  ${HOST_CORNER_SHAPE}
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
  //
  // This is a FUNCTION, not an inline IIFE, because the stylesheet is injected after the document loads: measuring at
  // parse time would read an unstyled chip (padding 0, no glyph) and place the × over the label. The spec calls it after
  // addStyleTag, which is the same order the component runs in - it measures on hover, long after the stylesheet exists.
  //
  // The leading slot's two inputs arrive as PIXELS because the chip inherits the composer's font size while the button
  // carries its own: an em value in the button's rule would not track the slot the chip reserved.
  window.__qcPlaceRemove = () => {
    const remove = document.querySelector('[data-qc-fixture-remove]')
    const chip = document.querySelector('[data-composer-chip="quote-chat"]')
    if (remove === null || chip === null) return null
    const box = chip.getBoundingClientRect()
    const padLeft = Number.parseFloat(getComputedStyle(chip).paddingLeft) || 0
    const glyph = Number.parseFloat(getComputedStyle(chip, '::before').width) || 0
    remove.style.setProperty('--qc-chip-left', box.left + 'px')
    remove.style.setProperty('--qc-chip-top', box.top + 'px')
    remove.style.setProperty('--qc-chip-height', box.height + 'px')
    remove.style.setProperty('--qc-chip-pad-left', padLeft + 'px')
    remove.style.setProperty('--qc-chip-glyph', glyph + 'px')
    return { padLeft, glyph }
  }
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

/** A passage short enough to fit the chip's ten-character budget. */
const SHORT = '地铁客流数据'
/** A passage long enough to be cut, so the ellipsis and the width budget are both visible. */
const LONG = '面向收支平衡的城际铁路票价优化模型研究'

/**
 * The states under review.
 *
 * Each one is a full page description plus, when the state involves the pointer, the movement that produces it.
 * `dark` is handled by the Playwright project's `colorScheme`, which is what the stylesheet's media query reads.
 */
export const CHIP_STATES = [
  {
    name: 'chip-rest',
    note: '一颗芯片，指针在远处：标签是引文开头',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-hover',
    note: '指针在芯片上：红色 × 占据类型图标的槽位',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT, hovered: true })}${PROSE_AFTER}</p>`,
      { remove: true }),
    act: hoverChip,
  },
  {
    name: 'chip-remove-hover',
    note: '指针在 × 上：圆片加深',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT, hovered: true })}${PROSE_AFTER}</p>`,
      { remove: true }),
    act: hoverRemove,
  },
  {
    name: 'chip-table',
    note: '表格注释：网格图标',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT, kind: 'table' })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-long',
    note: '长引文：截断到十个字符并以省略号收尾',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: `${[...LONG].slice(0, 10).join('')}…` })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-pair',
    note: '两颗芯片并排：宽度随引文变化',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT })}${chip({ num: 2, label: '文献综述' })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-shape-capsule',
    note: '形状对照 A：胶囊（样式表的 999px）',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-shape-rounded',
    note: '形状对照 B：圆角矩形 4px（内联覆盖，非产品状态）',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT, radius: '8px' })}${PROSE_AFTER}</p>`),
    act: parkPointer,
  },
  {
    name: 'chip-pair-hover-first',
    note: '并排时悬停第一颗：与第二颗的对比',
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT, hovered: true })}${chip({ num: 2, label: '文献综述' })}${PROSE_AFTER}</p>`,
      { remove: true }),
    act: hoverChip,
  },
  {
    name: 'chip-dark',
    note: '暗色：芯片自己的调色板',
    dark: true,
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT })}${PROSE_AFTER}</p>`, { dark: true }),
    act: parkPointer,
  },
  {
    name: 'chip-dark-hover',
    note: '暗色 + 悬停',
    dark: true,
    html: () => page(`<p dir="auto">${PROSE_BEFORE}${chip({ num: 1, label: SHORT, hovered: true })}${PROSE_AFTER}</p>`,
      { dark: true, remove: true }),
    act: hoverChip,
  },
]
