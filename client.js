/**
 * dsh-quote-chat — browser half.
 *
 * Two gestures over a passage of an answer:
 *
 * 1. **Annotate** — select text (or point at a table) in a model answer, add an
 *    optional comment, and the passage becomes a numbered annotation. The
 *    annotation gets a small colored marker in the answer's right gutter and a
 *    card in the strip above the composer; its content is appended to the draft
 *    so the model receives it.
 * 2. **Ask in side chat** — a right-Sidebar tab with a self-contained
 *    conversation about the passage, answered by this package's Host half.
 *
 * Why the cards live above the composer rather than inside it: the composer is
 * a Lexical editor whose node types are fixed when it is created (reference
 * chip, command chip, text ref). A plugin can insert plain text
 * (`InputActions.insertText`) or replace the whole draft (`setDraft`), but it
 * cannot introduce an interactive card node mid-document.
 * `conversation.input.dock` — the full-width strip directly above the composer
 * card — is the surface that is actually open to plugins, so the cards are
 * there, and the draft carries numbered blocks the user can move, edit, or
 * surround with their own prose.
 *
 * The only Host markers read are the chat flow container
 * (`[data-slot="conversation.chat.flow"]`) and the per-row
 * `data-chat-node-key` attributes: together they answer "which pass of which
 * answer is this?", which is what a jump-back needs.
 */

/** Largest annotated passage accepted, in UTF-16 code units. */
const MAX_QUOTE_CHARS = 8000

/** Annotations kept per session. */
const MAX_ANNOTATIONS = 12

/** Distance kept between a floating surface and the viewport edge, in px. */
const VIEWPORT_MARGIN = 8

/** Gap between a floating surface and its anchor, in px. */
const ANCHOR_GAP = 8

/** How long the jump-back highlight stays, in ms. */
const FLASH_MS = 2600

window.__ModuleLoader__.load({
  id: 'dsh-quote-chat',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const h = React.createElement

    /** This package's locale namespace. */
    const NS = 'quoteChat'

    /** The tab type contributed to the right Sidebar. */
    const TAB_ID = 'dsh-quote-chat:side'
    const TAB_KIND = 'dsh-quote-chat'

    /** The chat flow container: a selection outside it is not an answer passage. */
    const FLOW_SELECTOR = '[data-slot="conversation.chat.flow"]'

    /** Surfaces a selection must never come from. */
    const NON_ANSWER_SELECTOR = 'textarea, input, [contenteditable="true"], [data-slot="conversation.composer"]'

    /** Elements a card must not replay. */
    const UNSAFE_IN_CARD = 'script, style, iframe, object, embed, link, meta'

    // #region locales

    /** Simplified Chinese dictionary. */
    const zh = {
      'popup.annotate': '添加注释',
      'popup.askInSide': '在侧边聊天中提问',
      'popup.tooLong': '选中的内容太长（最多 {max} 字）',
      'popup.unavailable': '这段内容无法写入输入框',

      'compose.title': '添加注释',
      'compose.placeholder': '添加可选评论…',
      'compose.selected': '已选 {count} 字',
      'compose.table': '整张表格 · {rows} 行',
      'compose.confirm': '添加注释',
      'compose.cancel': '取消',
      'compose.hint': 'Enter 添加 · Esc 取消',

      'card.content': '注释 {n}',
      'card.remove': '删除注释',
      'card.count': '{n} 条注释',
      'card.clear': '全部清除',
      'card.missing': '这条注释对应的内容已不在当前对话中',
      'card.limit': '最多 {max} 条注释',

      'marker.jump': '跳到注释内容：内容 {n}',

      'table.add': '添加到对话',

      'side.title': '侧边提问',
      'side.guide': '就选中的一段回答单独提问，不影响主对话。',
      'side.empty': '就这段引文提问，例如：这里的假设成立吗？',
      'side.quote': '引文',
      'side.expandQuote': '展开引文',
      'side.collapseQuote': '收起引文',
      'side.send': '发送',
      'side.stop': '停止',
      'side.addToChat': '加入当前对话',
      'side.added': '已加入当前对话',
      'side.clear': '新对话',
      'side.placeholder': '就这段引文提问…',
      'side.errorPrefix': '回答失败：',
      'side.you': '你',
      'side.assistant': '助手',
      'side.noQuote': '从一个回答里划选一段文字，再点“在侧边聊天中提问”。',
    }

    /** English dictionary, keyed identically. */
    const en = {
      'popup.annotate': 'Add annotation',
      'popup.askInSide': 'Ask in side chat',
      'popup.tooLong': 'Selection is too long (max {max} characters)',
      'popup.unavailable': 'This passage cannot be written into the composer',

      'compose.title': 'Add annotation',
      'compose.placeholder': 'Add an optional comment…',
      'compose.selected': '{count} characters selected',
      'compose.table': 'Whole table · {rows} rows',
      'compose.confirm': 'Add annotation',
      'compose.cancel': 'Cancel',
      'compose.hint': 'Enter to add · Esc to cancel',

      'card.content': 'Note {n}',
      'card.remove': 'Remove annotation',
      'card.count': '{n} annotation(s)',
      'card.clear': 'Clear all',
      'card.missing': 'The passage for this annotation is no longer in this conversation',
      'card.limit': 'At most {max} annotations',

      'marker.jump': 'Jump to the passage: Content {n}',

      'table.add': 'Add to chat',

      'side.title': 'Side chat',
      'side.guide': 'Ask about one quoted passage without touching the main conversation.',
      'side.empty': 'Ask about this quote — for example: does this assumption hold?',
      'side.quote': 'Quote',
      'side.expandQuote': 'Expand quote',
      'side.collapseQuote': 'Collapse quote',
      'side.send': 'Send',
      'side.stop': 'Stop',
      'side.addToChat': 'Add to current chat',
      'side.added': 'Added to the current chat',
      'side.clear': 'New chat',
      'side.placeholder': 'Ask about this quote…',
      'side.errorPrefix': 'The answer failed: ',
      'side.you': 'You',
      'side.assistant': 'Assistant',
      'side.noQuote': 'Select a passage in an answer, then choose “Ask in side chat”.',
    }

    // #endregion

    // #region styles

    /** Package-owned stylesheet, removed with the plugin fiber. */
    const CSS = `
.qc-popup{position:fixed;z-index:2147483000;display:flex;align-items:stretch;gap:2px;padding:3px;
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

.qc-compose{position:fixed;z-index:2147483000;width:min(420px,92vw);box-sizing:border-box;
  border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);
  box-shadow:0 12px 32px rgba(0,0,0,.2);padding:10px;color:var(--dsw-alias-label-primary);
  font-size:12.5px;animation:qc-pop .1s ease-out}
.qc-compose-preview{max-height:88px;overflow-y:auto;padding:6px 8px;border-radius:8px;
  background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);
  color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55;word-break:break-word;
  white-space:pre-wrap;margin-bottom:8px}
.qc-compose-preview table{border-collapse:collapse;font-size:11px}
.qc-compose-preview td,.qc-compose-preview th{border:1px solid var(--dsw-alias-border-l1);padding:2px 5px}
.qc-compose-preview .katex{font-size:1em}
.qc-compose textarea{width:100%;box-sizing:border-box;resize:none;min-height:2.6em;max-height:9em;
  font:inherit;line-height:1.5;padding:7px 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);outline:none}
.qc-compose textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.qc-compose-row{display:flex;align-items:center;gap:8px;margin-top:8px}
.qc-compose-hint{flex:1;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.85;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qc-compose-confirm{appearance:none;border:0;border-radius:999px;width:26px;height:26px;flex:none;
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  background:var(--dsw-alias-brand-primary);color:#fff}
.qc-compose-cancel{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;border-radius:7px;
  padding:4px 10px;cursor:pointer;flex:none}

.qc-marker{position:fixed;z-index:2147482000;display:flex;align-items:center;justify-content:center;
  width:19px;height:19px;border-radius:999px;border:0;cursor:pointer;padding:0;
  font-size:11px;font-weight:600;line-height:1;color:#fff;font-family:inherit;
  box-shadow:0 1px 4px rgba(0,0,0,.22);transition:transform .12s ease}
.qc-marker:hover{transform:scale(1.18)}
.qc-marker-text{background:#2f7df6}
.qc-marker-table{background:#17a673}

.qc-table-add{position:fixed;z-index:2147482000;appearance:none;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
  border-radius:8px;padding:4px 9px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.14);
  display:flex;align-items:center;gap:5px;white-space:nowrap}
.qc-table-add:hover{background:var(--dsw-alias-bg-layer-2)}

/* The jump flash is a range highlight painted by the browser, not a positioned
   box: the ::highlight pseudo-element follows the text through scrolling and
   reflow, so it can never end up glowing over the composer while the passage is
   off-screen. */
::highlight(quote-chat-flash){background-color:rgba(255,214,0,.42);
  text-decoration:underline;text-decoration-color:rgba(255,196,0,.55);
  text-decoration-thickness:2px}
@keyframes qc-flash{0%,100%{opacity:.12}50%{opacity:1}}

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
[data-composer-chip="quote-chat"]{display:inline-flex;align-items:center;
  vertical-align:baseline;max-width:20em;padding:2px 9px 2px 7px;margin:0 1px;
  border-radius:999px;border:0;background:#f2f2f2;color:#181818;
  font-size:12.5px;line-height:1.5;cursor:pointer;position:relative;
  transition:background .14s ease}
[data-composer-chip="quote-chat"]:hover,
[data-composer-chip="quote-chat"]:focus-within{background:#e8e8e8}
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
  color:#181818;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Keep the host's own label out of the way so the ordinal is the only text. */
[data-composer-chip="quote-chat"] > span:last-child{display:none}

/* The removal control. Position comes from the chip's rectangle (inline style), so
   it lands in the pill's left slot where the kind glyph sits; the glyph fades out
   as this fades in, so exactly one of the two is ever visible. */
.qc-chip-remove{position:fixed;z-index:2147482100;
  appearance:none;box-sizing:border-box;margin:0;padding:0;border:0;
  border-radius:999px;background:#e8291c;color:#fff;
  font-size:9px;font-weight:700;line-height:1;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  transform:translateY(-50%);box-shadow:0 0 0 1.5px #f2f2f2;
  transition:background .12s ease}
.qc-chip-remove:hover{background:#c81f14}

/* Glyph: a rounded rectangle with a quote stroke inside it — the same "quoted
   text" mark the reference shows. Table chips get a grid glyph. */
:root{
  --qc-glyph-text:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='3' width='12' height='10' rx='2.5' fill='none' stroke='black' stroke-width='1.4'/><path d='M5.6 6.6h4.8M5.6 9.2h3' stroke='black' stroke-width='1.3' stroke-linecap='round'/></svg>");
  --qc-glyph-table:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='3.2' width='12' height='9.6' rx='1.8' fill='none' stroke='black' stroke-width='1.3'/><path d='M2 6.4h12M2 9.6h12M6.2 3.2v9.6' stroke='black' stroke-width='1.1'/></svg>");
}
[data-composer-chip="quote-chat"][data-qc-kind="table"]{--qc-glyph:var(--qc-glyph-table)}

/* ── The hover removal control ───────────────────────────────────────────────

   The red × from the reference: it pops out to the LEFT of the chip on hover and
   is the quick way to drop the annotation. It is a fixed overlay, not a chip
   child, because the chip's contents belong to the editor's React portal.

   Measured from the reference: an 18px circle, pure red, white × glyph, a thin
   white ring so it reads cleanly against the composer background. */
.qc-chip-remove{position:fixed;z-index:2147482100;appearance:none;box-sizing:border-box;
  width:18px;height:18px;margin:0;padding:0;border:1.5px solid #fff;
  border-radius:999px;background:#e8291c;color:#fff;
  font-size:11px;font-weight:700;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,.28);
  transition:background .12s ease,transform .12s ease}
.qc-chip-remove:hover{background:#c81f14;transform:translate(-50%,-50%) scale(1.12)}

/* ── The expanded preview card ───────────────────────────────────────────────

   Also measured from the reference: a white rounded panel floating ABOVE the
   chip, holding the rendered passage (a real table, scrollable, with its own
   scrollbar), sitting on the composer with a soft shadow. It carries the × and
   the comment; it does not repeat the truncated label. */
.qc-card{position:fixed;z-index:2147482000;width:min(560px,90vw);box-sizing:border-box;
  border:1px solid rgba(0,0,0,.07);border-radius:14px;background:#fff;
  box-shadow:0 10px 34px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.06);
  padding:10px 12px;color:#181818;cursor:pointer;animation:qc-pop .12s ease-out}
.qc-card-remove{position:absolute;right:8px;top:8px;z-index:2;appearance:none;
  border:0;width:18px;height:18px;border-radius:999px;background:#e9e9e9;
  color:#595959;font-size:12px;line-height:1;cursor:pointer;padding:0;
  display:flex;align-items:center;justify-content:center}
.qc-card-remove:hover{background:#dc2626;color:#fff}
.qc-card-comment{margin:0 0 8px;padding:6px 9px;border-radius:8px;
  background:#f6f6f6;color:#4b4b4b;font-size:12px;line-height:1.55;
  white-space:pre-wrap;word-break:break-word}
.qc-card-body{max-height:260px;overflow:auto;font-size:13px;line-height:1.6;
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
  border-left:2px solid #e0e0e0;color:#555}
.qc-card-body code{font-family:ui-monospace,monospace;font-size:.92em;
  padding:.1em .3em;border-radius:4px;background:#f2f2f2}
.qc-card-body pre{margin:.4em 0;padding:7px 9px;border-radius:8px;
  background:#f6f6f6;overflow-x:auto}
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
/* The expanded card's own header: the number badge and 注释 i. */
.qc-card-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;
  padding-bottom:7px;border-bottom:1px solid #ececec}
.qc-card-num{flex:none;width:17px;height:17px;border-radius:999px;color:#fff;
  font-size:10px;font-weight:600;display:flex;align-items:center;
  justify-content:center;line-height:1}
.qc-card-title{font-size:12.5px;font-weight:600;color:#181818;white-space:nowrap}
/* The footer chip mirrors the reference: a small × next to the annotation's
   name, which is the click target that removes it. */
.qc-card-hint{display:inline-flex;align-items:center;gap:5px;margin-top:8px;
  padding:4px 10px 4px 7px;border-radius:999px;background:#f2f2f2;
  font-size:12px;color:#181818}
.qc-card-hint::before{content:"×";font-size:13px;line-height:1;opacity:.7}

.qc-notice{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:2147483000;
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

    /**
     * Install the stylesheet once per plugin activation.
     * @param ctx - Client context owning the effect.
     */
    function installStyles(ctx) {
      ctx.effect(() => {
        if (typeof document === 'undefined') return undefined
        const tag = document.createElement('style')
        tag.dataset.quoteChat = ''
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => { tag.remove() }
      }, 'quote-chat: stylesheet')
    }

    // #endregion

    // #region generic helpers

    /**
     * Read the live composer draft through the standard `useInput` seat.
     * @param useInput - the slot's standard `useInput` prop, when present.
     * @param fallback - value reported when the seat is missing.
     * @returns the current draft text.
     */
    function useDraft(useInput, fallback = '') {
      const inert = (selector) => selector({ draft: fallback })
      return (typeof useInput === 'function' ? useInput : inert)(
        (state) => state.draft,
        (left, right) => left === right,
      )
    }

    /**
     * Read the draft's reference occurrences (the inline chips) through the same
     * seat.
     *
     * `InputState.occurrences` is the editor's own projection of the chips in
     * the draft, in clipboard order. It is what lets a removal cut exactly the
     * right span instead of re-deriving one from text offsets the user may have
     * edited around.
     * @param useInput - the slot's standard `useInput` prop, when present.
     * @returns the occurrence list, empty when unavailable.
     */
    function useDraftOccurrences(useInput) {
      const empty = React.useMemo(() => [], [])
      const inert = () => empty
      const picked = (typeof useInput === 'function' ? useInput : inert)(
        (state) => state.occurrences,
        (left, right) => left === right,
      )
      return Array.isArray(picked) ? picked : empty
    }

    /**
     * The element an endpoint node belongs to.
     * @param node - a DOM node.
     * @returns its element, or null.
     */
    function elementOf(node) {
      if (node === null || node === undefined) return null
      return node.nodeType === 1 ? node : node.parentElement
    }

    /** Drop the visible selection so the toolbar does not immediately reopen. */
    function clearSelection() {
      if (typeof window === 'undefined') return
      const selection = window.getSelection()
      if (selection !== null && selection.rangeCount > 0) selection.removeAllRanges()
    }

    /**
     * Escape one string for a CSS attribute selector.
     * @param value - the raw attribute value.
     * @returns the escaped form.
     */
    function cssEscape(value) {
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
      return value.replace(/["\\]/g, '\\$&')
    }

    // #endregion

    // #region text ranges

    /**
     * Build a DOM range from a character offset inside one element.
     * @param root - the containing element.
     * @param offset - start offset in `root.textContent`.
     * @param length - number of characters to cover.
     * @returns the range, or null when the offsets fall outside the element.
     */
    function rangeAt(root, offset, length) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let consumed = 0
      let startNode = null
      let startOffset = 0
      let endNode = null
      let endOffset = 0
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const next = consumed + node.data.length
        if (startNode === null && offset < next) {
          startNode = node
          startOffset = offset - consumed
        }
        if (startNode !== null && offset + length <= next) {
          endNode = node
          endOffset = offset + length - consumed
          break
        }
        consumed = next
      }
      if (startNode === null || endNode === null) return null
      const range = document.createRange()
      range.setStart(startNode, Math.max(0, Math.min(startOffset, startNode.data.length)))
      range.setEnd(endNode, Math.max(0, Math.min(endOffset, endNode.data.length)))
      return range
    }

    /**
     * The child-index path from an ancestor down to a node.
     * @param host - the ancestor element.
     * @param node - the descendant to locate.
     * @returns the index list, or null when `node` is not inside `host`.
     */
    function nodePath(host, node) {
      const path = []
      let current = node
      while (current !== null && current !== host) {
        const parent = current.parentNode
        if (parent === null) return null
        path.unshift([...parent.childNodes].indexOf(current))
        current = parent
      }
      return current === host ? path : null
    }

    /**
     * Walk a child-index path back to a node.
     * @param host - the ancestor element.
     * @param path - the index list.
     * @returns the node, or null when the tree no longer matches.
     */
    function nodeAtPath(host, path) {
      let current = host
      for (const index of path) {
        const next = current?.childNodes?.[index]
        if (next === undefined) return null
        current = next
      }
      return current ?? null
    }

    /**
     * Describe where a selection starts, in a form that survives a re-render.
     *
     * The anchor is a pair of DOM points (child-index path plus offset), not a
     * character count: `Range.toString()` inserts newlines across block
     * boundaries while `textContent` does not, so any offset measured one way and
     * replayed the other silently misses on a multi-paragraph selection.
     *
     * Paths are taken **relative to the flow**, not to the row: a selection that
     * starts in one paragraph and ends in the next produced an `endPath` that was
     * not a descendant of the start row, so it came back `null` and the whole
     * path branch was skipped — which is why a single-paragraph jump worked while
     * a longer one reported "no longer in this conversation". `nodeKey` still
     * rides along to scroll the right row into view and to prefer a row-local
     * match first.
     * @param range - the live selection range.
     * @param flow - the chat flow container.
     * @returns the anchor record.
     */
    function captureAnchor(range, flow) {
      const row = elementOf(range.startContainer)?.closest('[data-chat-node-key]') ?? null
      return {
        nodeKey: row?.getAttribute('data-chat-node-key') ?? '',
        startPath: nodePath(flow, range.startContainer),
        startOffset: range.startOffset,
        endPath: nodePath(flow, range.endContainer),
        endOffset: range.endOffset,
        quote: range.toString(),
      }
    }

    /**
     * Rebuild the range one anchor describes.
     *
     * Four things can go wrong between capture and click, and each used to fail
     * silently:
     *
     * - the row is not in the DOM at all (the flow virtualizes long
     *   conversations), handled by resolving against the flow instead;
     * - the subtree was rebuilt (a settled stream, a rendered formula, a
     *   collapsed tool row), so the recorded path now points at different text —
     *   handled by validating the rebuilt range against the quote instead of
     *   trusting it because it is non-empty;
     * - the two ends live in different rows, which a row-scoped path could not
     *   express;
     * - the passage moved, handled by the text fallback.
     * @param flow - the chat flow container.
     * @param anchor - the stored anchor.
     * @returns the range, or null when the passage is gone.
     */
    function resolveAnchor(flow, anchor) {
      if (flow === null || anchor.quote === '') return null

      // Preferred path: the exact DOM points recorded at capture time — but only
      // if they still resolve to the quoted text. A rebuilt subtree can leave the
      // path structurally valid and semantically wrong, and returning that would
      // scroll to an unrelated sentence.
      if (Array.isArray(anchor.startPath) && Array.isArray(anchor.endPath)) {
        const startNode = nodeAtPath(flow, anchor.startPath)
        const endNode = nodeAtPath(flow, anchor.endPath)
        if (startNode !== null && endNode !== null) {
          try {
            const range = document.createRange()
            range.setStart(startNode, Math.min(anchor.startOffset, (startNode.textContent ?? '').length))
            range.setEnd(endNode, Math.min(anchor.endOffset, (endNode.textContent ?? '').length))
            if (sameText(range.toString(), anchor.quote)) return range
          } catch {
            // The tree moved under us; fall through to the text search.
          }
        }
      }

      // The owning row first: it is the tightest match and keeps a phrase that
      // appears several times in the answer on the row it came from.
      const row = anchor.nodeKey === ''
        ? null
        : flow.querySelector(`[data-chat-node-key="${cssEscape(anchor.nodeKey)}"]`)
      if (row !== null) {
        const local = locateText(row, anchor.quote)
        if (local !== null) {
          const range = rangeAt(row, local.offset, local.length)
          if (range !== null) return range
        }
      }

      // Last resort: the whole flow. This is what makes a row that unmounted
      // (virtualization), a passage that re-rendered elsewhere, or a selection
      // spanning two rows still reachable.
      const anywhere = locateText(flow, anchor.quote)
      return anywhere === null ? null : rangeAt(flow, anywhere.offset, anywhere.length)
    }

    /**
     * Whether two passages say the same thing, ignoring whitespace differences.
     * @param left - the first passage.
     * @param right - the second passage.
     * @returns true when they match after collapsing runs of whitespace.
     */
    function sameText(left, right) {
      const flat = (value) => value.replace(/\s+/g, ' ').trim()
      return flat(left) === flat(right)
    }

    /**
     * Find a quoted passage inside one element's text.
     *
     * Both sides are whitespace-collapsed before comparing, so a brief that spans
     * a paragraph break still matches the row's flat text.
     * @param host - the element to search.
     * @param quote - the captured text.
     * @returns the offset and length in `host`'s raw text, or null.
     */
    function locateText(host, quote) {
      const raw = host.textContent ?? ''
      const exact = raw.indexOf(quote)
      if (exact >= 0) return { offset: exact, length: quote.length }
      // Whitespace-insensitive retry: collapse the needle and the haystack in
      // lockstep, remembering where each collapsed character came from.
      const needle = quote.replace(/\s+/g, ' ').trim()
      if (needle === '') return null
      const starts = []
      let flat = ''
      let pendingSpace = false
      for (let index = 0; index < raw.length; index += 1) {
        const char = raw[index]
        if (/\s/.test(char)) {
          pendingSpace = flat !== ''
          continue
        }
        if (pendingSpace) {
          starts.push(index - 1)
          flat += ' '
          pendingSpace = false
        }
        starts.push(index)
        flat += char
      }
      const at = flat.indexOf(needle)
      if (at < 0) return null
      const from = starts[at]
      const to = starts[at + needle.length - 1]
      return { offset: from, length: (to - from) + 1 }
    }

    // #endregion

    // #region selection reading

    /**
     * Read the current selection as a quotable answer passage.
     * @returns text, range, flow, anchor, kind, and preview, or null when the
     * selection is empty, outside the chat flow, or inside an input surface.
     */
    function readSelection() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return null
      const selection = window.getSelection()
      if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return null
      const text = selection.toString()
      if (typeof text !== 'string' || text.trim() === '') return null
      const startElement = elementOf(selection.anchorNode)
      const endElement = elementOf(selection.focusNode)
      if (startElement === null || endElement === null) return null
      const flow = startElement.closest(FLOW_SELECTOR)
      // A selection leaving the flow (or spanning two flows) is not one passage.
      if (flow === null || !flow.contains(endElement)) return null
      // The user's own message is already theirs; tool cards are not prose.
      if (startElement.closest('[data-chat-flow-kind="user"]') !== null) return null
      // A right-Sidebar tab owns its own composer.
      if (startElement.closest('[data-sidebar-right-tab]') !== null) return null
      if (startElement.closest(NON_ANSWER_SELECTOR) !== null) return null
      const range = selection.getRangeAt(0)
      let rect
      try {
        rect = range.getBoundingClientRect()
      } catch {
        return null
      }
      if (rect === undefined || (rect.width === 0 && rect.height === 0)) return null
      // A table is its own card, never merged with prose: the requirement is
      // explicit that a table gets a separate annotation. If the selection simply
      // touches a table — starting inside it and running out into the paragraph,
      // or the reverse — narrow the annotation to the table instead of quietly
      // swallowing it into a text card.
      const table = startElement.closest('table') ?? endElement.closest('table')
      if (table !== null && flow.contains(table)) {
        return {
          kind: 'table',
          text: tableToMarkdown(table),
          previewHtml: '',
          previewText: table.innerText.trim(),
          rect: table.getBoundingClientRect(),
          anchor: tableAnchor(flow, table),
        }
      }
      return {
        kind: 'text',
        text: text.trim(),
        previewHtml: fragmentHtml(range.cloneContents()),
        previewText: text.trim(),
        rect,
        anchor: captureAnchor(range, flow),
      }
    }

    /**
     * Serialize a DOM fragment to HTML a card can replay.
     * @param fragment - the cloned selection contents.
     * @returns sanitized markup.
     */
    function fragmentHtml(fragment) {
      const host = document.createElement('div')
      host.appendChild(fragment)
      for (const node of host.querySelectorAll(UNSAFE_IN_CARD)) node.remove()
      for (const node of host.querySelectorAll('*')) {
        for (const attribute of [...node.attributes]) {
          const name = attribute.name.toLowerCase()
          if (name.startsWith('on')) node.removeAttribute(attribute.name)
        }
      }
      return host.innerHTML
    }

    /**
     * Convert one table into a compact Markdown table.
     * @param table - the source table element.
     * @returns Markdown rows, one line each.
     */
    function tableToMarkdown(table) {
      const rows = [...table.rows].map((row) => [...row.cells].map((cell) => cell.innerText.replace(/\s+/g, ' ').trim()))
      const usable = rows.filter((row) => row.length > 0)
      if (usable.length === 0) return ''
      const width = Math.max(...usable.map((row) => row.length))
      const pad = (row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]
      const line = (row) => `| ${pad(row).map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`
      const head = usable[0]
      return [line(head), `| ${pad(head).map(() => '---').join(' | ')} |`, ...usable.slice(1).map(line)].join('\n')
    }

    // #endregion

    // #region annotation store

    /**
     * Per-session annotation lists, kept in memory for the lifetime of the page.
     *
     * A tiny external store rather than a framework service: the only readers
     * are this package's own components, and the list has to be shared between
     * the dock strip and the gutter markers.
     */
    const annotationStores = new Map()

    /**
     * The store for one session, created on demand.
     * @param sessionId - the session key.
     * @returns the store.
     */
    function storeFor(sessionId) {
      let store = annotationStores.get(sessionId)
      if (store === undefined) {
        store = { list: [], listeners: new Set(), seq: 0 }
        annotationStores.set(sessionId, store)
      }
      return store
    }

    /**
     * Publish a new list to every reader.
     * @param store - the store being written.
     * @param list - the replacement list.
     */
    function publish(store, list) {
      store.list = list
      for (const listener of [...store.listeners]) listener()
    }

    /**
     * Renumber a list so the visible numbers are always 1, 2, 3 … in order.
     *
     * The number is a position, not an identity. A monotonic counter was wrong in
     * the way the user described: after deleting an annotation the next one keeps
     * climbing (1, 2, 3 → delete 2 → 4), and a session that already had
     * annotations pushes the first new one past 1. Renumbering on every mutation
     * keeps each draft's numbering starting at 1.
     * @param list - the annotations in insertion order.
     * @returns the same annotations with fresh `number` values.
     */
    function renumber(list) {
      return list.map((item, index) => (item.number === index + 1
        ? item
        : { ...item, number: index + 1 }))
    }

    /**
     * Add one annotation to a session.
     * @param sessionId - the session key.
     * @param draft - the annotation draft (without id or number).
     * @returns the stored annotation, or null when the list is full.
     */
    function addAnnotation(sessionId, draft) {
      const store = storeFor(sessionId)
      if (store.list.length >= MAX_ANNOTATIONS) return null
      store.seq += 1
      const annotation = { ...draft, id: `qc-${Date.now()}-${store.seq}`, number: store.list.length + 1 }
      publish(store, renumber([...store.list, annotation]))
      return annotation
    }

    /**
     * Remove one annotation.
     * @param sessionId - the session key.
     * @param id - the annotation id.
     */
    function removeAnnotation(sessionId, id) {
      const store = storeFor(sessionId)
      publish(store, renumber(store.list.filter((item) => item.id !== id)))
    }

    /**
     * Remove every annotation of a session.
     * @param sessionId - the session key.
     */
    function clearAnnotations(sessionId) {
      const store = storeFor(sessionId)
      if (store.list.length > 0) publish(store, [])
    }

    /** The empty list shared by sessions that never annotated anything. */
    const NO_ANNOTATIONS = Object.freeze([])

    /**
     * Subscribe to one session's annotations.
     * @param sessionId - the session key (may be undefined).
     * @returns the current list.
     */
    function useAnnotations(sessionId) {
      const store = sessionId === undefined ? undefined : storeFor(sessionId)
      const subscribe = React.useCallback(
        (listener) => {
          if (store === undefined) return () => {}
          store.listeners.add(listener)
          return () => { store.listeners.delete(listener) }
        },
        [store],
      )
      const snapshot = React.useCallback(
        () => (store === undefined ? NO_ANNOTATIONS : store.list),
        [store],
      )
      return React.useSyncExternalStore(subscribe, snapshot, snapshot)
    }

    // #endregion

    // #region inline chips

    /**
     * The source name this package registers its chips under.
     *
     * `setDraft({ text, references })` runs the composer's `restoreDraft`, which
     * mints a real `ReferenceChipNode` per reference: an atomic, inline,
     * non-editable decorator that lives in the text flow beside ordinary
     * characters. That is the only way a plugin can put something in the middle
     * of the draft — and it is exactly what an annotation needs, because the
     * card then sits *inside* the message the user is writing, between their own
     * sentences, instead of being appended as a detached block.
     *
     * The chip carries only an id. Its content lives in this plugin's registry,
     * and the framework pulls it out at two moments: `codec.serialize` when the
     * draft is submitted (the model form), and `openReference` when the chip is
     * clicked (the preview). That is why neither the passage nor the comment has
     * to sit in the draft as loose text.
     */
    const CHIP_SOURCE = 'quote-chat'

    /** The trigger this source registers under; `@` and `/` belong to the host. */
    const CHIP_TRIGGER = '#'

    /** One character standing in for the chip in the draft text. */
    const CHIP_PLACEHOLDER = '\uFFFC'

    /**
     * The chips this browser has minted, keyed by id.
     *
     * `codec.serialize` and `openReference` receive only the ref string, so the
     * payload has to be findable from here. A `Map` on the module keeps the
     * lookup synchronous, which matters because `serialize` runs inside the
     * submit attempt.
     */
    const chipPayloads = new Map()

    /**
     * The dock's jump function, published for the reference source.
     *
     * The source is registered at `apply` time (one per plugin, not per session),
     * while jumping needs the mounted dock's own handler — so the dock installs
     * itself here on mount and the source calls through it.
     */
    const chipJumpHandler = { current: null }

    /**
     * The text one chip contributes to the message the model receives.
     *
     * This is the whole point of the codec: the chip stays a token in the draft,
     * and the passage plus its comment are unfolded here, at submit time.
     *
     * The block is fenced with newlines because a chip can sit mid-sentence: the
     * expansion is spliced into the draft text, so without the fence the passage
     * would run straight into the words around it ("…如下和这里"), and the model
     * could not tell the user's prose from the quoted passage. The leading and
     * trailing breaks collapse harmlessly when the chip is at either end because
     * the assembled message is trimmed.
     * @param payload - the recorded annotation content.
     * @returns the model-facing text.
     */
    function serializeChipForModel(payload) {
      const head = `[${payload.label}]`
      const note = payload.comment === '' ? '' : `\n${payload.comment}`
      return `\n${head}${note}\n${payload.text}\n`
    }

    /**
     * The label a chip shows in the composer: `内容 i` (`内容 1`, `内容 2`, …).
     *
     * This is the requirement verbatim — "在聊天框的呈现文字为内容 i，内容 i+1…".
     * The chip is a named block, not a preview of the passage: the passage itself
     * lives in the hover card, and the model receives it through the codec. An
     * earlier revision put the truncated passage here after reading a screenshot
     * too literally; the numbered block is what was asked for.
     * @param annotation - the annotation being placed.
     * @param labels - the active locale's card labels.
     * @returns the inline label.
     */
    function chipLabel(annotation, labels) {
      return labels.content.replace('{n}', String(annotation.number))
    }

    /**
     * A short plain-text preview of the passage, used for card headers and the
     * jump hint.
     * @param annotation - the annotation.
     * @returns the flattened passage, single-spaced.
     */
    function previewOf(annotation) {
      const flat = (annotation.previewText || annotation.text || '').replace(/\s+/g, ' ').trim()
      if (flat !== '') return flat
      return annotation.kind === 'table' ? '表格' : '引文'
    }

    /**
     * The draft text and reference list that put one annotation into the draft.
     *
     * The reference's `clipboardText` is the placeholder the editor maps back to
     * a chip, and `offset`/`length` locate it, so the pair has to be built
     * together. The passage and the comment do NOT go into the draft text: they
     * are registered under the chip id and expanded by the codec on submit, so
     * the card stays one clean token the user can move around and the model still
     * receives the full passage.
     * @param annotation - the annotation to insert.
     * @param labels - the active locale's card labels.
     * @returns the placeholder text plus its reference record.
     */
    function chipReference(annotation, labels) {
      const label = chipLabel(annotation, labels)
      chipPayloads.set(annotation.id, {
        kind: annotation.kind,
        number: annotation.number,
        text: annotation.text,
        comment: annotation.comment,
        label,
      })
      return {
        source: CHIP_SOURCE,
        ref: annotation.id,
        offset: 0,
        length: CHIP_PLACEHOLDER.length,
        label,
        clipboardText: CHIP_PLACEHOLDER,
      }
    }

    /**
     * Rebuild the whole draft with one more chip appended.
     *
     * A chip's `offset` is measured in the final draft text, so every insertion
     * rebuilds the text and re-computes the existing references from the same
     * string the composer will parse.
     *
     * No separator is inserted: an empty draft becomes just the chip, and a draft
     * the user already ended with a newline keeps that newline as the only break.
     * Adding `\n\n` here used to leave a blank paragraph above the first chip,
     * which is where the stray empty line in the composer came from.
     * @param draft - current draft text.
     * @param existing - references already in that draft.
     * @param addition - the placeholder text (and trailing comment) to append.
     * @param reference - the new reference without its offset filled in.
     * @returns the complete snapshot for `setDraft`.
     */
    function withAppendedChip(draft, existing, addition, reference) {
      const base = draft === '' || draft.endsWith('\n') ? draft : `${draft}\n`
      return {
        text: `${base}${addition}`,
        references: [...existing, { ...reference, offset: base.length }],
      }
    }

    /**
     * Remove one chip occurrence from a draft and reference list.
     *
     * Only the chip and its placeholder go: the comment now lives inside the
     * chip's payload rather than as loose prose after it, so there is no trailing
     * text to sweep up. One adjacent line break is removed as well when it would
     * otherwise leave an empty paragraph, and every later reference shifts left
     * by exactly what was removed.
     * @param draft - current draft text.
     * @param references - the references in that draft.
     * @param ref - the annotation id the chip carries.
     * @returns the snapshot with the chip gone, or null when the chip is no
     * longer in the draft.
     */
    function withoutChip(draft, references, ref) {
      const index = references.findIndex((item) => item.source === CHIP_SOURCE && item.ref === ref)
      if (index < 0) return null
      const target = references[index]
      let start = target.offset
      let stop = target.offset + target.length
      // When the chip occupies a line by itself, removing it would leave that
      // line empty. "Occupies a line" means it is bounded by a break or the draft
      // edge on both sides; exactly one break then goes with it, preferring the
      // one before when both exist.
      const brokenBefore = start > 0 && draft[start - 1] === '\n'
      const brokenAfter = stop < draft.length && draft[stop] === '\n'
      const ownsLine = (start === 0 || brokenBefore) && (stop === draft.length || brokenAfter)
      if (ownsLine) {
        if (brokenBefore) start -= 1
        else if (brokenAfter) stop += 1
      }
      const removed = draft.slice(start, stop)
      const nextText = `${draft.slice(0, start)}${draft.slice(stop)}`
      // Everything after the cut moves left by the removed length.
      const shift = removed.length
      const kept = references
        .filter((_, position) => position !== index)
        .map((item) => (item.offset >= stop ? { ...item, offset: item.offset - shift } : item))
      return { text: nextText, references: kept }
    }

    // #endregion

    // #region icons

    /** The "annotate" glyph: a quote bubble with a plus. */
    function IconAnnotate() {
      return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M2.6 4.4h6a1.3 1.3 0 0 1 1.3 1.3v3.6a1.3 1.3 0 0 1-1.3 1.3H5.3L3 12.8V5.7',
          stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        }),
        h('path', {
          d: 'M12 3.1v3.8M10.1 5h3.8',
          stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.7,
        }),
      )
    }

    /** The "side chat" glyph: a panel split off the main one. */
    function IconSideChat() {
      return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('rect', { x: 1.8, y: 2.6, width: 8.2, height: 8.9, rx: 1.4, stroke: 'currentColor', 'stroke-width': 1.3 }),
        h('path', {
          d: 'M10.1 5.2h2.6a1.3 1.3 0 0 1 1.3 1.3v6.2l-2.1-1.6',
          stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        }),
      )
    }

    /** The confirm glyph. */
    function IconCheck() {
      return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M3.4 8.5l3 3 6.2-7',
          stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        }),
      )
    }

    // #endregion

    // #region side-chat transport

    /**
     * The Host route for one side-chat answer, resolved against the page base so
     * a reverse-proxy prefix (or the desktop shell's custom scheme) keeps
     * working.
     * @returns an absolute URL.
     */
    function askUrl() {
      const base = typeof document !== 'undefined' && typeof document.baseURI === 'string' && document.baseURI !== ''
        ? document.baseURI
        : 'http://dsh.internal/'
      return new URL('quote-chat/api/ask', base).href
    }

    /**
     * Stream one answer from the Host half.
     * @param request - quote, question, prior exchanges, and the interface language.
     * @param signal - caller cancellation.
     * @param onDelta - called with each text fragment.
     * @returns the complete answer text.
     * @throws an Error carrying the Host's own message.
     */
    async function askSideChat(request, signal, onDelta) {
      const response = await fetch(askUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal,
        credentials: 'same-origin',
      })
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        // A refusal before the stream opens arrives as the JSON envelope.
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let answer = ''
      const handleFrame = (frame) => {
        if (!frame.startsWith('data:')) return false
        let event
        try {
          event = JSON.parse(frame.slice(5).trim())
        } catch {
          return false
        }
        if (event.type === 'delta' && typeof event.text === 'string') {
          answer += event.text
          onDelta(event.text)
          return false
        }
        if (event.type === 'error') {
          throw new Error(typeof event.message === 'string' ? event.message : 'the answer failed')
        }
        return event.type === 'done'
      }
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          boundary = buffer.indexOf('\n\n')
          if (handleFrame(frame)) return answer
        }
      }
      return answer
    }

    // #endregion

    // #region floating surfaces

    /**
     * Place a floating surface near an anchor, inside the viewport.
     * @param rect - the anchor rectangle.
     * @param size - the surface size.
     * @returns fixed-position coordinates.
     */
    function placeNear(rect, size) {
      const width = size.width
      const height = size.height
      let left = rect.left + rect.width / 2 - width / 2
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN))
      let top = rect.top - height - ANCHOR_GAP
      if (top < VIEWPORT_MARGIN) {
        top = Math.min(rect.bottom + ANCHOR_GAP, window.innerHeight - height - VIEWPORT_MARGIN)
      }
      return { left: Math.max(VIEWPORT_MARGIN, left), top: Math.max(VIEWPORT_MARGIN, top) }
    }

    /**
     * The floating action pair shown over a selected passage.
     * @param props - anchor rect, capability flags, labels, and handlers.
     */
    function ActionPopup(props) {
      const { anchor, canAnnotate, canAsk, labels, onAnnotate, onAsk } = props
      const ref = React.useRef(null)
      const [size, setSize] = React.useState({ width: 0, height: 0 })

      React.useLayoutEffect(() => {
        const element = ref.current
        if (element === null) return
        const rect = element.getBoundingClientRect()
        setSize({ width: rect.width, height: rect.height })
      }, [])

      const position = placeNear(anchor, { width: size.width || 210, height: size.height || 34 })
      return createPortal(
        h('div', {
          ref,
          className: 'qc-popup',
          role: 'toolbar',
          style: {
            left: `${position.left}px`,
            top: `${position.top}px`,
            visibility: size.width === 0 ? 'hidden' : 'visible',
          },
          // The selection must survive the click that chooses an action.
          onMouseDown: (event) => event.preventDefault(),
        },
        h('button', { type: 'button', disabled: !canAnnotate, onClick: onAnnotate },
          h(IconAnnotate, null), labels.annotate),
        h('button', { type: 'button', disabled: !canAsk, onClick: onAsk },
          h(IconSideChat, null), labels.askInSide),
        ),
        document.body,
      )
    }

    /**
     * The annotation editor: a preview of what will be attached, an optional
     * comment, and the confirm pair.
     * @param props - the source, labels, and handlers.
     */
    function ComposerPopover(props) {
      const { source, labels, onConfirm, onCancel } = props
      const ref = React.useRef(null)
      const inputRef = React.useRef(null)
      const [comment, setComment] = React.useState('')
      const [size, setSize] = React.useState({ width: 0, height: 0 })

      React.useLayoutEffect(() => {
        const element = ref.current
        if (element === null) return
        const rect = element.getBoundingClientRect()
        setSize({ width: rect.width, height: rect.height })
        inputRef.current?.focus()
      }, [])

      const position = placeNear(source.rect, {
        width: size.width || 420,
        height: size.height || 170,
      })

      return createPortal(
        h('div', {
          ref,
          className: 'qc-compose',
          role: 'dialog',
          'aria-label': labels.title,
          style: { left: `${position.left}px`, top: `${position.top}px` },
          onMouseDown: (event) => event.stopPropagation(),
          onKeyDown: (event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              onCancel()
            }
          },
        },
        source.previewHtml !== ''
          // The model's own markup, replayed: the preview shows the passage the
          // way the answer showed it, emphasis and math included.
          ? h('div', {
            className: 'qc-compose-preview',
            dangerouslySetInnerHTML: { __html: source.previewHtml },
          })
          : h('div', { className: 'qc-compose-preview' }, source.previewText),
        source.kind === 'table'
          ? null
          : h('textarea', {
            ref: inputRef,
            value: comment,
            rows: 2,
            placeholder: labels.placeholder,
            onChange: (event) => setComment(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
                event.preventDefault()
                onConfirm(comment)
              }
            },
          }),
        h('div', { className: 'qc-compose-row' },
          h('span', { className: 'qc-compose-hint' },
            source.kind === 'table'
              ? labels.table.replace('{rows}', String(source.rows ?? 0))
              : `${labels.selected.replace('{count}', String(source.previewText.length))} · ${labels.hint}`),
          h('button', { type: 'button', className: 'qc-compose-cancel', onClick: onCancel }, labels.cancel),
          h('button', {
            type: 'button',
            className: 'qc-compose-confirm',
            title: labels.confirm,
            'aria-label': labels.confirm,
            onClick: () => onConfirm(source.kind === 'table' ? '' : comment),
          }, h(IconCheck, null)),
        ),
        ),
        document.body,
      )
    }

    // #endregion

    // #region annotation strip

/**
 * Bind each annotation to its chip and show that chip's card on hover.
 *
 * The chip's look is entirely CSS (see the `[data-composer-chip="quote-chat"]`
 * rules): the host's own decorator renders the label, and a ::before badge fed by
 * `data-qc-num` draws the number. This pass never writes into a chip — its
 * children are the editor's React portal, and mutating them is what once broke
 * typing.
 *
 * The card appears on hover only. Showing it permanently meant it had to track
 * the chip's box at all times, and any drift between measurement and paint left
 * it straddling the wrong characters; on hover it is only ever briefly on screen.
 * @param props - the annotations, the live chip list, labels, and handlers.
 */
function ChipCards(props) {
  const { annotations, occurrences, labels, onJump, onRemove } = props
  // Handlers live in a ref so the effect does not rebuild on every render.
  const actionsRef = React.useRef({ onJump, onRemove })
  actionsRef.current = { onJump, onRemove }
  const [hover, setHover] = React.useState(null)
  // The same value, readable from the DOM handlers without re-binding them.
  const hoverRef = React.useRef(null)
  hoverRef.current = hover

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined
    let frame = 0
    let timer = 0
    const marked = new Set()

    /** Drop our attributes from one chip. */
    const unmark = (chip) => {
      delete chip.dataset.qcNum
      delete chip.dataset.qcKind
      delete chip.dataset.qcLabel
      marked.delete(chip)
    }

    /**
     * Pair each live chip with the annotation its occurrence names.
     *
     * Pairing is by reference id, not position: a chip the user deleted by hand
     * drops out of `occurrences`, and a positional pairing would then bind every
     * later card one chip to the left.
     * @returns the pairs in DOM order.
     */
    const pairs = () => {
      const refs = occurrences
        .filter((item) => item.source === CHIP_SOURCE)
        .map((item) => item.ref)
      const chips = [...document.querySelectorAll('[data-composer-chip="quote-chat"]')]
        .filter((element) => element.closest('[data-sidebar-right-tab]') === null)
      const result = []
      for (let index = 0; index < chips.length && index < refs.length; index += 1) {
        const annotation = annotations.find((item) => item.id === refs[index])
        if (annotation !== undefined) result.push({ chip: chips[index], annotation })
      }
      return result
    }

    const apply = () => {
      frame = 0
      if (typeof document === 'undefined') return
      const live = new Set()
      for (const { chip, annotation } of pairs()) {
        live.add(chip)
        // Attributes only: the number badge is drawn by CSS from this value.
        chip.dataset.qcNum = String(annotation.number)
        chip.dataset.qcKind = annotation.kind === 'table' ? 'table' : 'text'
        // The ordinal shown on the chip. CSS renders it via ::after, so the text
        // is guaranteed to appear even though the host's own label span does not.
        chip.dataset.qcLabel = labels.content.replace('{n}', String(annotation.number))
        marked.add(chip)
      }
      for (const chip of [...marked]) {
        if (!live.has(chip)) unmark(chip)
      }
    }

    const schedule = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(apply)
    }
    const debounced = () => {
      clearTimeout(timer)
      timer = setTimeout(schedule, 70)
    }
    schedule()
    const observer = new MutationObserver(debounced)
    observer.observe(document.body, { childList: true, subtree: true })

    /** The chip under a pointer event, or null. */
    const chipOf = (event) => (event.target instanceof Element
      ? event.target.closest('[data-composer-chip="quote-chat"]')
      : null)

    /**
     * The annotation a pointer is currently "on", in the loose sense that keeps
     * the × and the card reachable: the chip itself, the ×, or the card.
     * @param event - the pointer event.
     * @returns the annotation, null while inside a floating piece with nothing
     * open, or undefined when the pointer is elsewhere.
     */
    const hoverTargetOf = (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (target === null) return undefined
      const inFloating = target.closest('.qc-card') !== null
        || target.closest('.qc-chip-remove') !== null
      if (inFloating) {
        // Inside the × or the card: keep whatever is showing (null = nothing).
        return hoverRef.current?.annotation ?? null
      }
      const chip = chipOf(event)
      if (chip === null) return undefined
      return pairs().find((pair) => pair.chip === chip)?.annotation
    }

    // One handler for the whole gesture. A pointer that is on neither the chip nor
    // either floating piece clears the hover; anything else keeps it, so moving
    // onto the × or up into the card never blinks the UI away. Handling this on
    // `mouseover` alone also covers leaving the ×, which a chip-scoped `mouseout`
    // could never see.
    const onPointer = (event) => {
      const annotation = hoverTargetOf(event)
      // `undefined` = pointer is elsewhere; `null` = inside a piece with nothing
      // open. Both mean there is nothing to show.
      if (annotation === undefined || annotation === null) {
        setHover(null)
        return
      }
      const chip = pairs().find((pair) => pair.annotation.id === annotation.id)?.chip
      if (chip === undefined) return
      const rect = chip.getBoundingClientRect()
      setHover((current) => {
        if (current !== null && current.annotation.id === annotation.id
          && current.anchor.left === Math.round(rect.left)
          && current.anchor.top === Math.round(rect.top)
          && current.anchor.width === Math.round(rect.width)
          && current.anchor.height === Math.round(rect.height)) return current
        return { annotation, anchor: {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        } }
      })
    }
    // While open, follow the chip: the composer scrolls and grows as you type.
    const reposition = () => {
      setHover((current) => {
        if (current === null) return current
        const still = pairs().find((pair) => pair.annotation.id === current.annotation.id)
        if (still === undefined) return null
        const rect = still.chip.getBoundingClientRect()
        const next = {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
        if (current.anchor.left === next.left && current.anchor.top === next.top
          && current.anchor.width === next.width && current.anchor.height === next.height) {
          return current
        }
        return { annotation: current.annotation, anchor: next }
      })
    }
    document.addEventListener('mouseover', onPointer, true)
    document.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)

    // Clicking the chip jumps. `openReference` covers the editor's own activation
    // path; this covers a plain click on the token itself.
    const onClick = (event) => {
      const chip = chipOf(event)
      if (chip === null) return
      const annotation = pairs().find((pair) => pair.chip === chip)?.annotation
      if (annotation === undefined) return
      event.preventDefault()
      event.stopPropagation()
      actionsRef.current.onJump(annotation)
    }
    document.addEventListener('click', onClick, true)

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener('mouseover', onPointer, true)
      document.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('click', onClick, true)
      for (const chip of [...marked]) unmark(chip)
    }
  }, [annotations, occurrences, labels])

  if (hover === null) return null
  // The × is drawn INSIDE the chip's left edge, in the slot the kind glyph
  // occupies — the two never show at once. It is a fixed overlay pinned to the
  // chip's own rectangle rather than a chip child, because the chip's contents
  // are the editor's and must not be written into. `6px` matches the pill's own
  // left padding, so the control sits where the glyph was.
  const CHIP_INSET = 6
  const CHIP_GLYPH = 14
  return createPortal(
    h(React.Fragment, null,
      h('button', {
        type: 'button',
        className: 'qc-chip-remove',
        title: labels.remove,
        'aria-label': labels.remove,
        style: {
          position: 'fixed',
          left: `${hover.anchor.left + CHIP_INSET}px`,
          top: `${hover.anchor.top + (hover.anchor.height / 2)}px`,
          width: `${CHIP_GLYPH}px`,
          height: `${CHIP_GLYPH}px`,
        },
        onMouseDown: (event) => event.preventDefault(),
        onClick: (event) => {
          event.preventDefault()
          event.stopPropagation()
          setHover(null)
          onRemove(hover.annotation)
        },
      }, '×'),
      h(AnnotationCard, {
        annotation: hover.annotation,
        anchor: hover.anchor,
        labels,
        onJump: () => {
          setHover(null)
          onJump(hover.annotation)
        },
        onRemove: () => {
          setHover(null)
          onRemove(hover.annotation)
        },
      }),
    ),
    document.body,
  )
}

/**
 * The expanded preview card for one annotation.
 *
 * Matched to the reference screenshot: a white rounded panel floating above the
 * composer, holding the passage rendered as it appears in the answer — a real
 * table with borders when the annotation is a table, formatted text otherwise —
 * and a small footer pill reading `× <label>` that removes it.
 *
 * The passage is shown rendered, not as raw Markdown: the reference clearly shows
 * the table with its cells and check marks, not pipes and dashes.
 * @param props - the annotation, its chip rectangle, labels, and handlers.
 */
function AnnotationCard(props) {
  const { annotation, anchor, labels, onJump, onRemove } = props
  const ref = React.useRef(null)
  const [size, setSize] = React.useState({ width: 0, height: 0 })

  React.useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const box = element.getBoundingClientRect()
    setSize({ width: box.width, height: box.height })
  }, [annotation.id])

  const width = size.width || 520
  const height = size.height || 160
  // Prefer above the chip, like the reference; drop below when there is no room.
  const above = anchor.top - height - 10
  const top = above >= VIEWPORT_MARGIN ? above : anchor.top + anchor.height + 10
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, anchor.left),
    Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
  )
  return h('div', {
    ref,
    className: 'qc-card',
    role: 'dialog',
    title: labels.jump.replace('{n}', String(annotation.number)),
    style: {
      left: `${left}px`,
      top: `${top}px`,
      visibility: size.width === 0 ? 'hidden' : 'visible',
    },
    onMouseDown: (event) => event.preventDefault(),
    onClick: onJump,
  },
  h('button', {
    type: 'button',
    className: 'qc-card-remove',
    title: labels.remove,
    'aria-label': labels.remove,
    onClick: (event) => {
      event.stopPropagation()
      onRemove()
    },
  }, '×'),
  annotation.comment === ''
    ? null
    : h('div', { className: 'qc-card-comment' }, annotation.comment),
  h('div', { className: 'qc-card-body' },
    annotation.kind === 'table'
      ? h('div', { dangerouslySetInnerHTML: { __html: tableHtml(annotation.text) } })
      : h('div', { dangerouslySetInnerHTML: { __html: annotation.previewHtml ?? '' } }),
  ),
  // A named header: the number badge plus `注释 i`, so the expanded card is
  // self-describing without repeating the whole label at the bottom.
  h('div', { className: 'qc-card-head' },
    h('span', { className: `qc-card-num ${annotation.kind === 'table' ? 'qc-marker-table' : 'qc-marker-text'}` },
      String(annotation.number)),
    h('span', { className: 'qc-card-title' }, labels.content.replace('{n}', String(annotation.number))),
  ),
  )
}

/**
 * Render a Markdown table as an HTML table for the preview.
 *
 * The preview shows the passage as the reader saw it, so a table has to be a real
 * table — pipes and header rules would not read as the same thing.
 * @param markdown - the captured Markdown table.
 * @returns HTML for the table, or a plain-text fallback.
 */
function tableHtml(markdown) {
  const rows = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()))
    // Drop the `|---|---|` separator row.
    .filter((cells) => cells.length > 0 && !cells.every((cell) => /^:?-{2,}:?$/.test(cell)))
  if (rows.length === 0) return `<pre class="qc-card-md">${escapeHtml(markdown)}</pre>`
  const head = rows[0]
  const body = rows.slice(1)
  const cell = (tag, text) => `<${tag}>${escapeHtml(text)}</${tag}>`
  return `<table><thead><tr>${head.map((text) => cell('th', text)).join('')}</tr></thead>`
    + `<tbody>${body.map((cells) => `<tr>${cells.map((text) => cell('td', text)).join('')}</tr>`).join('')}</tbody></table>`
}

/**
 * Escape text for safe insertion into HTML.
 * @param text - the raw text.
 * @returns the escaped text.
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

    // #endregion

    // #region gutter markers

    /**
     * Find the conversation's chat flow, skipping a right-Sidebar occurrence.
     *
     * The slot anchor is rendered with `display: contents` — the framework's own
     * comment says it "keeps the wrapper out of layout … the anchor is purely
     * addressable surface". A box-less element has **no client rects**, so the
     * old `getClientRects().length === 0` liveness test rejected every valid
     * flow and reported "no chat flow". Visibility is therefore judged by its
     * children, which are ordinary boxes.
     * @returns the flow element, or null.
     */
    function findFlow() {
      if (typeof document === 'undefined') return null
      let fallback = null
      for (const element of document.querySelectorAll(FLOW_SELECTOR)) {
        if (element.closest('[data-sidebar-right-tab]') !== null) continue
        // `display: contents` gives the anchor no box of its own, so measure the
        // rows it contains instead.
        if (element.getClientRects().length > 0 || hasBoxedChild(element)) return element
        if (fallback === null) fallback = element
      }
      // An empty conversation legitimately has no rows yet; keep it rather than
      // claiming the flow does not exist.
      return fallback
    }

    /**
     * Whether an element contains any child that occupies layout.
     * @param element - the candidate container.
     * @returns true when at least one descendant renders a box.
     */
    function hasBoxedChild(element) {
      if (typeof element.getClientRects === 'function' && element.getClientRects().length > 0) return true
      for (const child of element.children) {
        if (child.getClientRects().length > 0) return true
      }
      return false
    }

    /**
     * The right-gutter buttons that mark where each annotation came from.
     *
     * They are portaled and re-measured on scroll, because the chat flow is a
     * scroll container: a marker drawn inside it would be clipped by its own
     * overflow and would fight the row layout.
     * @param props - the annotations, labels, and the jump handler.
     */
    function MarkerLayer(props) {
      const { annotations, labels, onJump } = props
      const [positions, setPositions] = React.useState([])

      React.useEffect(() => {
        if (typeof document === 'undefined') return undefined
        let frame = 0
        let timer = 0
        const measure = () => {
          frame = 0
          const flow = findFlow()
          if (flow === null) {
            setPositions((current) => (current.length === 0 ? current : []))
            return
          }
          const flowRect = flow.getBoundingClientRect()
          const right = Math.min(flowRect.right - 12, window.innerWidth - 26)
          const next = []
          for (const annotation of annotations) {
            const range = resolveAnchor(flow, annotation.anchor)
            if (range === null) continue
            const rect = range.getBoundingClientRect()
            if (rect.width === 0 && rect.height === 0) continue
            if (rect.bottom < flowRect.top || rect.top > flowRect.bottom) continue
            next.push({
              id: annotation.id,
              top: Math.round(rect.top + rect.height / 2 - 9),
              left: Math.round(right),
              tone: annotation.kind === 'table' ? 'qc-marker-table' : 'qc-marker-text',
              number: annotation.number,
              title: labels.jump.replace('{n}', String(annotation.number)),
            })
          }
          setPositions((current) => {
            if (current.length === next.length
              && current.every((item, index) => {
                const other = next[index]
                return item.id === other.id && item.top === other.top && item.left === other.left
              })) return current
            return next
          })
        }
        const schedule = () => {
          if (frame !== 0) return
          frame = requestAnimationFrame(measure)
        }
        const debounced = () => {
          clearTimeout(timer)
          timer = setTimeout(schedule, 80)
        }
        schedule()
        document.addEventListener('scroll', schedule, true)
        window.addEventListener('resize', schedule)
        const observer = new MutationObserver(debounced)
        const flow = findFlow()
        if (flow !== null) observer.observe(flow, { childList: true, subtree: true, characterData: true })
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame)
          clearTimeout(timer)
          document.removeEventListener('scroll', schedule, true)
          window.removeEventListener('resize', schedule)
          observer.disconnect()
        }
      }, [annotations, labels])

      if (typeof document === 'undefined' || positions.length === 0) return null
      return createPortal(
        h(React.Fragment, null,
          positions.map((position) => h('button', {
            key: position.id,
            type: 'button',
            className: `qc-marker ${position.tone}`,
            style: { left: `${position.left}px`, top: `${position.top}px` },
            title: position.title,
            'aria-label': position.title,
            onClick: () => {
              const annotation = annotations.find((item) => item.id === position.id)
              if (annotation !== undefined) onJump(annotation)
            },
          }, String(position.number))),
        ),
        document.body,
      )
    }

    // #endregion

    // #region table affordance

    /**
     * The "add this table" button that follows the pointer across answer tables.
     *
     * A table cannot share an annotation with the prose around it, so it gets
     * its own control instead of relying on a text selection.
     * @param props - the label and the handler.
     */
    function TableAddButton(props) {
      const { label, onAdd } = props
      const [target, setTarget] = React.useState(null)

      React.useEffect(() => {
        if (typeof document === 'undefined') return undefined
        let frame = 0
        let pending = null
        const apply = () => {
          frame = 0
          if (pending === null) {
            setTarget((current) => (current === null ? current : null))
            return
          }
          const rect = pending.getBoundingClientRect()
          setTarget((current) => {
            if (current !== null && current.element === pending
              && current.rect.top === rect.top && current.rect.right === rect.right) return current
            return { element: pending, rect }
          })
        }
        const schedule = () => {
          if (frame !== 0) return
          frame = requestAnimationFrame(apply)
        }
        const onMove = (event) => {
          const element = elementOf(event.target)
          const flow = element?.closest(FLOW_SELECTOR) ?? null
          const table = flow === null || element === null ? null : element.closest('table')
          pending = table !== null && flow !== null && flow.contains(table) ? table : null
          schedule()
        }
        const onLeave = () => {
          pending = null
          schedule()
        }
        document.addEventListener('mousemove', onMove, true)
        document.addEventListener('mouseleave', onLeave, true)
        document.addEventListener('scroll', onLeave, true)
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame)
          document.removeEventListener('mousemove', onMove, true)
          document.removeEventListener('mouseleave', onLeave, true)
          document.removeEventListener('scroll', onLeave, true)
        }
      }, [])

      if (target === null || typeof document === 'undefined') return null
      const position = {
        left: Math.max(VIEWPORT_MARGIN, target.rect.right - 116),
        top: Math.max(VIEWPORT_MARGIN, target.rect.top + 4),
      }
      return createPortal(
        h('button', {
          type: 'button',
          className: 'qc-table-add',
          style: { left: `${position.left}px`, top: `${position.top}px` },
          onMouseDown: (event) => event.preventDefault(),
          onClick: () => onAdd(target.element),
        }, h(IconAnnotate, null), label),
        document.body,
      )
    }

    /**
     * Explain why a jump missed, in terms of the state that actually failed.
     *
     * "Not found" is useless when debugging, because the failures are different:
     * no flow at all, the row unmounted (the transcript pages distant rows out
     * of the DOM), or the row present but the passage gone from it. Reporting the
     * mounted-row count and the stored quote length turns the next report into a
     * diagnosis instead of another guess.
     * @param flow - the chat flow, or null.
     * @param annotation - the annotation that failed to resolve.
     * @returns the notice text.
     */
    function diagnoseMiss(flow, annotation) {
      const anchor = annotation.anchor ?? {}
      const quote = typeof anchor.quote === 'string' ? anchor.quote : ''
      const head = quote.length > 18 ? `${quote.slice(0, 18)}…` : quote
      if (flow === null) return `找不到对话区域 / no chat flow (quote ${quote.length} chars: ${head})`
      const rows = flow.querySelectorAll('[data-chat-node-key]')
      const row = anchor.nodeKey === ''
        ? null
        : flow.querySelector(`[data-chat-node-key="${cssEscape(anchor.nodeKey)}"]`)
      if (row === null) {
        return `翻遍对话仍未加载到原文所在消息 / row never loaded (${rows.length} rows mounted, quote ${quote.length} chars: ${head})`
      }
      return `消息还在，但其中找不到这段引文 / row present, quote missing (${quote.length} chars: ${head})`
    }

    // #endregion

    /**
     * The nearest scrollable ancestor of the chat flow.
     *
     * The transcript is virtualized: rows far outside the viewport are removed
     * from the DOM and re-created when scrolled back into range. Finding the
     * scroller is what makes "scroll until the row comes back" possible.
     * @param flow - the chat flow element.
     * @returns the scrolling element, or null.
     */
    function scrollContainerOf(flow) {
      let node = flow.parentElement
      while (node !== null) {
        const style = getComputedStyle(node)
        if (/(auto|scroll)/.test(`${style.overflowY}`) && node.scrollHeight > node.clientHeight + 4) {
          return node
        }
        node = node.parentElement
      }
      return null
    }

    /**
     * The highlight registry name for the jump flash.
     *
     * `CSS.highlights` binds a painted decoration to a live `Range`. That is the
     * whole reason it is used here instead of portal divs: the browser re-projects
     * the range onto the page on every scroll and reflow, so the glow cannot
     * drift away from the words it belongs to. An absolutely-positioned overlay
     * measured once is a photograph of a position, and the screenshot showing a
     * glow stuck over the composer while the passage was off-screen is exactly
     * what a stale photograph looks like.
     */
    const FLASH_HIGHLIGHT = 'quote-chat-flash'

    /**
     * Whether this engine can paint range highlights.
     * @returns true when `CSS.highlights` is available.
     */
    function canPaintHighlight() {
      return typeof CSS !== 'undefined'
        && CSS !== null
        && typeof CSS.highlights === 'object'
        && CSS.highlights !== null
        && typeof Highlight === 'function'
    }

    /**
     * Paint the flash on a resolved range and clear it after a moment.
     *
     * The range itself is handed to the registry, so scrolling keeps the glow on
     * the text; nothing has to be re-measured.
     * @param range - the passage to highlight.
     * @param ms - how long the flash lasts.
     */
    function flashRange(range, ms = FLASH_MS) {
      if (!canPaintHighlight()) return
      try {
        const highlight = new Highlight(range)
        CSS.highlights.set(FLASH_HIGHLIGHT, highlight)
        // The passage may be scrolled into view after this call; the highlight
        // follows on its own, so a plain timeout is enough.
        setTimeout(() => {
          if (CSS.highlights.get(FLASH_HIGHLIGHT) === highlight) CSS.highlights.delete(FLASH_HIGHLIGHT)
        }, ms)
      } catch (failure) {
        console.error('[dsh-quote-chat] highlight failed:', failure)
      }
    }

    /**
     * Clear any flash currently painted.
     */
    function clearFlashRange() {
      if (!canPaintHighlight()) return
      CSS.highlights.delete(FLASH_HIGHLIGHT)
    }

    /**
     * Resolve one annotation, scrolling the transcript until its row loads.
     *
     * This is the part that was missing. The transcript unmounts rows that
     * scroll far away, so an annotation captured on an older answer has no DOM
     * to point at until that answer is paged back in — `resolveAnchor` correctly
     * reported "gone" and the jump looked broken. Here the scroller is walked in
     * both directions, giving the virtualizer a frame to mount each new page,
     * until the passage resolves or the transcript stops moving.
     * @param flow - the chat flow element.
     * @param annotation - the annotation to reveal.
     * @returns the resolved range, or null when it is truly gone.
     */
    async function revealWithSearch(flow, annotation) {
      const immediate = resolveAnchor(flow, annotation.anchor)
      if (immediate !== null) return scrollToRange(immediate, flow)

      const scroller = scrollContainerOf(flow)
      if (scroller === null) return null
      const start = scroller.scrollTop
      const step = Math.max(160, Math.round(scroller.clientHeight * 0.8))

      // Sweep outward from where the user is now: older passages are usually
      // above, but a passage from a later answer is below, so both run.
      const sweep = async (direction) => {
        let barren = 0
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const before = scroller.scrollTop
          scroller.scrollTop = before + step * direction
          // Two frames: one for the scroll to apply, one for the virtualizer to
          // mount the page it just admitted.
          await nextFrame()
          await nextFrame()
          const live = findFlow() ?? flow
          const hit = resolveAnchor(live, annotation.anchor)
          if (hit !== null) return scrollToRange(hit, live)
          if (scroller.scrollTop === before) {
            // Hit an end; two attempts in a row with no movement means done.
            barren += 1
            if (barren > 1) return null
          } else {
            barren = 0
          }
        }
        return null
      }

      const up = await sweep(-1)
      if (up !== null) return up
      scroller.scrollTop = start
      await nextFrame()
      return sweep(1)
    }

    /**
     * Wait for the next animation frame.
     * @returns a promise resolved on the next frame.
     */
    function nextFrame() {
      return new Promise((resolve) => {
        if (typeof requestAnimationFrame !== 'function') {
          resolve()
          return
        }
        requestAnimationFrame(() => resolve())
      })
    }

    /**
     * Bring one resolved range into view and hand it back.
     *
     * Only the scroll is done here; the glow is painted by the browser's
     * highlight registry, which keeps it glued to the text afterwards.
     * @param range - the resolved passage range.
     * @param flow - the chat flow.
     * @returns the same range.
     */
    function scrollToRange(range, flow) {
      const host = elementOf(range.startContainer)?.closest('[data-chat-node-key]') ?? flow
      host.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
      return range
    }

    // #endregion

    // #region side chat panel

    /**
     * One side-chat thread: the quoted passage, the exchange so far, and the
     * composer. All state is local to this tab.
     * @param props - the quote, a translate function, and the composer actions.
     */
    function SideChat(props) {
      const { quote, t, locale, inputActions, useInput } = props
      const draft = useDraft(useInput)
      const [messages, setMessages] = React.useState([])
      const [question, setQuestion] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [expanded, setExpanded] = React.useState(false)
      const [added, setAdded] = React.useState(false)
      const abortRef = React.useRef(null)
      const threadRef = React.useRef(null)

      // A new passage is a new thread: the previous exchange was about a
      // different quote, and mixing the two would make answers unattributable.
      React.useEffect(() => {
        abortRef.current?.abort()
        abortRef.current = null
        setMessages([])
        setQuestion('')
        setError('')
        setBusy(false)
        setAdded(false)
      }, [quote])

      React.useEffect(() => () => { abortRef.current?.abort() }, [])

      const scrollToEnd = React.useCallback(() => {
        const element = threadRef.current
        if (element !== null) element.scrollTop = element.scrollHeight
      }, [])

      React.useEffect(scrollToEnd, [messages, scrollToEnd])

      const submit = React.useCallback(async () => {
        const text = question.trim()
        if (text === '' || busy) return
        const history = messages
          .filter((message) => message.text.trim() !== '')
          .map((message) => ({ role: message.role, text: message.text }))
        // The Host wants completed Q/A pairs, so fold the finished exchange and
        // send the new question separately.
        const replayed = []
        for (let index = 0; index < history.length; index += 1) {
          const current = history[index]
          const next = history[index + 1]
          if (current.role === 'user' && next !== undefined && next.role === 'assistant') {
            replayed.push({ question: current.text, answer: next.text })
            index += 1
          }
        }
        setMessages((current) => [...current, { role: 'user', text }, { role: 'assistant', text: '' }])
        setQuestion('')
        setError('')
        setBusy(true)
        const controller = new AbortController()
        abortRef.current = controller
        try {
          await askSideChat({ quote, question: text, history: replayed, locale }, controller.signal, (delta) => {
            setMessages((current) => {
              const copy = current.slice()
              const last = copy.length - 1
              if (last < 0) return current
              copy[last] = { role: 'assistant', text: copy[last].text + delta }
              return copy
            })
          })
        } catch (failure) {
          if (controller.signal.aborted) {
            setMessages((current) => {
              const copy = current.slice()
              const last = copy.length - 1
              if (last >= 0 && copy[last].role === 'assistant' && copy[last].text === '') copy.pop()
              return copy
            })
          } else {
            setError(failure instanceof Error ? failure.message : String(failure))
          }
        } finally {
          if (abortRef.current === controller) abortRef.current = null
          setBusy(false)
        }
      }, [question, busy, messages, quote, locale])

      const stop = React.useCallback(() => {
        abortRef.current?.abort()
        abortRef.current = null
        setBusy(false)
      }, [])

      /** Append one passage to the current session's composer draft. */
      const addToChat = React.useCallback((text) => {
        const payload = text
          .split(/\r?\n/)
          .map((line) => (line === '' ? '>' : `> ${line}`))
          .join('\n')
        const current = typeof draft === 'string' ? draft : ''
        if (typeof inputActions?.captureInsertion === 'function'
          && typeof inputActions?.insertText === 'function') {
          const span = inputActions.captureInsertion()
          if (inputActions.insertText(`${payload}\n\n`, span) === true) {
            setAdded(true)
            return
          }
        }
        if (typeof inputActions?.setDraft === 'function') {
          inputActions.setDraft(current.trim() === '' ? payload : `${current}\n\n${payload}`)
          setAdded(true)
        }
      }, [draft, inputActions])

      React.useEffect(() => {
        if (!added) return undefined
        const timer = setTimeout(() => setAdded(false), 2200)
        return () => clearTimeout(timer)
      }, [added])

      const lastAssistant = [...messages].reverse()
        .find((message) => message.role === 'assistant' && message.text !== '')
      const lastQuestion = [...messages].reverse().find((message) => message.role === 'user')

      return h('div', { className: 'qc-side' },
        h('div', { className: 'qc-side-head' },
          h('span', { className: 'qc-side-head-title' }, t('side.title')),
          messages.length > 0
            ? h('button', {
              type: 'button',
              onClick: () => { setMessages([]); setError(''); setAdded(false) },
            }, t('side.clear'))
            : null,
        ),
        h('div', { className: 'qc-quote' },
          h('div', { className: 'qc-quote-label' },
            h('span', null, t('side.quote')),
            quote.length > 260
              ? h('button', {
                type: 'button',
                onClick: () => setExpanded((value) => !value),
              }, expanded ? t('side.collapseQuote') : t('side.expandQuote'))
              : null,
          ),
          h('div', { className: `qc-quote-body${expanded ? '' : ' qc-clamped'}` }, quote),
        ),
        h('div', { ref: threadRef, className: 'qc-thread' },
          messages.length === 0
            ? h('div', { className: 'qc-empty' }, t('side.empty'))
            : messages.map((message, index) => h('div', {
              key: `${index}-${message.role}`,
              className: `qc-msg qc-msg-${message.role}`,
            },
            h('div', { className: 'qc-msg-role' },
              message.role === 'user' ? t('side.you') : t('side.assistant')),
            h('div', { className: 'qc-msg-body' },
              message.text === '' && busy && index === messages.length - 1
                ? h('span', { className: 'qc-dots' })
                : message.text),
            message.role === 'assistant' && message.text !== ''
              ? h('div', { className: 'qc-msg-actions' },
                h('button', {
                  type: 'button',
                  onClick: () => addToChat(message.text),
                }, t('side.addToChat')))
              : null,
            )),
          error === ''
            ? null
            : h('div', { className: 'qc-msg-error' }, `${t('side.errorPrefix')}${error}`),
        ),
        h('div', { className: 'qc-side-compose' },
          h('textarea', {
            value: question,
            placeholder: t('side.placeholder'),
            rows: 2,
            onChange: (event) => setQuestion(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
                event.preventDefault()
                submit()
              }
            },
          }),
          h('div', { className: 'qc-side-compose-row' },
            h('span', { className: 'qc-side-compose-hint' }, added ? t('side.added') : ''),
            lastAssistant !== undefined
              ? h('button', {
                type: 'button',
                className: 'qc-btn qc-btn-ghost',
                onClick: () => addToChat(
                  `> ${lastQuestion === undefined ? '' : lastQuestion.text}\n\n${lastAssistant.text}`,
                ),
              }, t('side.addToChat'))
              : null,
            busy
              ? h('button', { type: 'button', className: 'qc-btn qc-btn-ghost', onClick: stop }, t('side.stop'))
              : h('button', {
                type: 'button',
                className: 'qc-btn',
                disabled: question.trim() === '',
                onClick: submit,
              }, t('side.send')),
          ),
        ),
      )
    }

    /**
     * The passage the popup asked the side chat to open with. The tab body reads
     * its own navigation params first, and falls back to this only briefly — a
     * host that opens the tab without carrying them still shows the right
     * quote, while a guide-entry open minutes later does not resurrect it.
     */
    const pendingQuote = { text: '', at: 0 }

    /** How long a pending quote stays eligible, in ms. */
    const PENDING_QUOTE_TTL = 15000

    /**
     * The quote a freshly opened side chat should show.
     * @param carried - the quote the tab's own navigation params carried.
     * @returns the carried quote, a fresh pending one, or an empty string.
     */
    function quoteForTab(carried) {
      if (typeof carried === 'string' && carried !== '') return carried
      const fresh = Date.now() - pendingQuote.at < PENDING_QUOTE_TTL
      return fresh ? pendingQuote.text : ''
    }

    /**
     * The tab body: read the quote the tab was opened with, then hand it to the
     * panel.
     *
     * `t` arrives from the framework (a registration with `locale` gets the
     * bound translate seat), `pluginCtx` from this registration's `inject`, and
     * `inputActions`/`useInput` are standard session props.
     * @param props - standard session props, the tab hook context, and the
     * injected seats.
     */
    function SideChatTab(props) {
      const { useTabInfo, inputActions, useInput, t, pluginCtx } = props
      const info = typeof useTabInfo === 'function' ? useTabInfo() : undefined
      const quote = quoteForTab(info?.tab?.navigation?.params?.quote)
      // A locale switch must reach the Host prompt language, so subscribe to the
      // locale snapshot rather than reading it once.
      const localeService = pluginCtx?.locale
      const locale = React.useSyncExternalStore(
        React.useCallback(
          (listener) => (typeof localeService?.subscribe === 'function' ? localeService.subscribe(listener) : () => {}),
          [localeService],
        ),
        React.useCallback(
          () => (typeof localeService?.getLocale === 'function' ? localeService.getLocale().active : 'zh'),
          [localeService],
        ),
        React.useCallback(() => 'zh', []),
      )

      if (quote === '') {
        return h('div', { className: 'qc-side' },
          h('div', { className: 'qc-quote' },
            h('div', { className: 'qc-quote-body' }, t('side.noQuote')),
          ),
        )
      }
      return h(SideChat, { quote, t, locale: locale === 'en' ? 'en' : 'zh', inputActions, useInput })
    }

    // #endregion

    // #region table anchor

    /**
     * Anchor one table inside the flow, addressed by its own DOM path so the
     * gutter marker lands on the table rather than on the paragraph before it.
     *
     * The path is relative to the flow, matching `captureAnchor`, so a table
     * survives the row around it being rebuilt.
     * @param flow - the chat flow container.
     * @param table - the table element.
     * @returns the anchor record.
     */
    function tableAnchor(flow, table) {
      const row = table.closest('[data-chat-node-key]') ?? null
      const path = nodePath(flow, table)
      return {
        nodeKey: row?.getAttribute('data-chat-node-key') ?? '',
        // A table anchors as a single element: start and end are the same node,
        // so the range covers the whole table rather than a character run.
        startPath: path,
        startOffset: 0,
        endPath: path,
        endOffset: table.childNodes.length,
        quote: table.innerText.trim(),
      }
    }

    // #endregion

    // #region annotation dock

    /**
     * Build the composer-dock controller: it watches the selection and the
     * pointer over answer tables, runs the annotation workflow, and renders the
     * strip, the gutter markers, and the jump highlight.
     * @param deps - the plugin's Client context and bound translate function.
     * @returns the React component registered into `conversation.input.dock`.
     */
    function annotationDock(deps) {
      const { ctx, t: boundT } = deps
      return function AnnotationDock(props) {
        const { inputActions, useInput, sessionId } = props
        const t = typeof props.t === 'function' ? props.t : boundT
        const draft = useDraft(useInput)
        // The chip list is the authority on which annotations are still in the
        // draft; the annotation store alone cannot tell an edited-away chip.
        const occurrences = useDraftOccurrences(useInput)
        const inputStateRef = React.useRef(null)
        inputStateRef.current = { draft, occurrences }
        const annotations = useAnnotations(sessionId)
        /** `{ kind: 'actions' | 'compose', source }` — one floating surface at a time. */
        const [overlay, setOverlay] = React.useState(null)
        const [notice, setNotice] = React.useState('')
        const overlayRef = React.useRef(null)
        overlayRef.current = overlay

        const labels = React.useMemo(() => ({
          annotate: t('popup.annotate'),
          askInSide: t('popup.askInSide'),
          tooLong: t('popup.tooLong'),
          unavailable: t('popup.unavailable'),
          title: t('compose.title'),
          placeholder: t('compose.placeholder'),
          selected: t('compose.selected'),
          table: t('compose.table'),
          confirm: t('compose.confirm'),
          cancel: t('compose.cancel'),
          hint: t('compose.hint'),
          content: t('card.content'),
          remove: t('card.remove'),
          count: t('card.count'),
          clear: t('card.clear'),
          missing: t('card.missing'),
          limit: t('card.limit'),
          jump: t('marker.jump'),
          tableAdd: t('table.add'),
        }), [t])

        // Dismissal: a press anywhere outside the open surface closes it.
        React.useEffect(() => {
          if (overlay === null) return undefined
          const onPointerDown = (event) => {
            const surface = document.querySelector('.qc-popup, .qc-compose')
            if (surface !== null && surface.contains(event.target)) return
            setOverlay(null)
          }
          const onKeyDown = (event) => {
            if (event.key === 'Escape') setOverlay(null)
          }
          document.addEventListener('mousedown', onPointerDown, true)
          document.addEventListener('keydown', onKeyDown, true)
          return () => {
            document.removeEventListener('mousedown', onPointerDown, true)
            document.removeEventListener('keydown', onKeyDown, true)
          }
        }, [overlay === null])

        // Selection tracking.
        //
        // The popup may only appear once the point has been released: `selectstart`
        // and `selectionchange` both fire while the pointer is still down, and a
        // `position: fixed` toolbar rendered mid-drag swallows the rest of the
        // gesture, freezing the selection at the first few characters. So the
        // pointer state gates every evaluation, and the keyboard path (which has
        // no pointer) opens on `keyup` only.
        React.useEffect(() => {
          if (typeof document === 'undefined') return undefined
          let frame = 0
          let pointerDown = false
          const evaluate = () => {
            frame = 0
            if (overlayRef.current !== null) return
            if (pointerDown) return
            const next = readSelection()
            if (next === null) {
              setOverlay((current) => (current === null || current.kind === 'actions' ? null : current))
              return
            }
            if (next.text.length > MAX_QUOTE_CHARS) {
              setNotice(labels.tooLong.replace('{max}', String(MAX_QUOTE_CHARS)))
              setOverlay(null)
              return
            }
            setOverlay({ kind: 'actions', source: next })
          }
          const schedule = () => {
            if (frame !== 0) return
            frame = requestAnimationFrame(evaluate)
          }
          const onDown = () => {
            pointerDown = true
          }
          const onUp = () => {
            pointerDown = false
            // Let the browser finish committing the selection before reading it.
            schedule()
          }
          document.addEventListener('pointerdown', onDown, true)
          document.addEventListener('mousedown', onDown, true)
          document.addEventListener('pointerup', onUp, true)
          document.addEventListener('mouseup', onUp, true)
          document.addEventListener('keyup', schedule, true)
          document.addEventListener('selectionchange', schedule)
          return () => {
            if (frame !== 0) cancelAnimationFrame(frame)
            document.removeEventListener('pointerdown', onDown, true)
            document.removeEventListener('mousedown', onDown, true)
            document.removeEventListener('pointerup', onUp, true)
            document.removeEventListener('mouseup', onUp, true)
            document.removeEventListener('keyup', schedule, true)
            document.removeEventListener('selectionchange', schedule)
          }
        }, [labels])

        React.useEffect(() => {
          if (notice === '') return undefined
          const timer = setTimeout(() => setNotice(''), 3200)
          return () => clearTimeout(timer)
        }, [notice])

        // The flash is painted by the browser's highlight registry, which clears
        // itself; there is no React state to expire here any more.
        React.useEffect(() => () => clearFlashRange(), [])

        /**
         * Put one annotation into the draft as an inline chip.
         *
         * `setDraft({ text, references })` is the only channel that reaches the
         * editor's `restoreDraft`, which mints a real inline `ReferenceChipNode`
         * — an atomic, non-editable decorator sitting in the text flow. The chip
         * therefore behaves like the `@file` chips: arrows step across it,
         * Backspace removes it whole, and the user can type prose before and
         * after it in the same paragraph.
         *
         * Only the placeholder goes into the text. The passage and comment stay
         * in the payload registry and are expanded by `codec.serialize` on
         * submit, so the card is one clean token rather than a token followed by
         * loose prose.
         * @param annotation - the annotation to place.
         * @returns whether the draft accepted the chip.
         */
        const writeChip = React.useCallback((annotation) => {
          if (typeof inputActions?.setDraft !== 'function') return false
          const current = typeof draft === 'string' ? draft : ''
          const existing = Array.isArray(inputStateRef.current?.occurrences)
            ? inputStateRef.current.occurrences
            : []
          try {
            const reference = chipReference(annotation, labels)
            inputActions.setDraft(withAppendedChip(current, existing, CHIP_PLACEHOLDER, reference))
            return true
          } catch (failure) {
            console.error('[dsh-quote-chat] chip insertion failed:', failure)
            return false
          }
        }, [draft, inputActions, labels])

        /** Store one annotation and mirror it into the draft as an inline chip. */
        const commit = React.useCallback((source, comment) => {
          if (sessionId === undefined) return
          const text = typeof comment === 'string' ? comment.trim() : ''
          const stored = addAnnotation(sessionId, {
            kind: source.kind,
            text: source.text,
            previewText: source.previewText,
            // The captured markup is what the card replays. It used to be stored
            // under `html` while the card read `previewHtml`, so every card body
            // came out blank — the "content is not rendered" symptom.
            previewHtml: source.kind === 'table' ? '' : source.previewHtml,
            // A table is annotatable too: the requirement asks for a comment box
            // on tables, so its comment is kept like any other.
            comment: text,
            anchor: source.anchor,
          })
          if (stored === null) {
            setNotice(labels.limit.replace('{max}', String(MAX_ANNOTATIONS)))
            return
          }
          if (!writeChip(stored)) setNotice(labels.unavailable)
          setOverlay(null)
          clearSelection()
          // Confirm the passage was captured by flashing it. It is already in
          // view (it was just selected), so no scroll is needed.
          const flow = findFlow()
          const range = flow === null ? null : resolveAnchor(flow, stored.anchor)
          if (range !== null) flashRange(range)
        }, [sessionId, labels, writeChip])

        /** Open the annotation editor for one table. */
        const annotateTable = React.useCallback((table) => {
          const markdown = tableToMarkdown(table)
          if (markdown === '') return
          const flow = findFlow()
          setOverlay({
            kind: 'compose',
            source: {
              kind: 'table',
              text: markdown,
              previewHtml: '',
              previewText: markdown,
              rect: table.getBoundingClientRect(),
              rows: table.rows.length,
              anchor: flow === null
                ? { nodeKey: '', offset: 0, quote: '' }
                : tableAnchor(flow, table),
            },
          })
          clearSelection()
        }, [])

        const onJump = React.useCallback((annotation) => {
          const flow = findFlow()
          if (flow === null) {
            setNotice(diagnoseMiss(null, annotation))
            return
          }
          setNotice(null)
          // Async because the transcript unmounts distant rows: a passage from an
          // older answer has no DOM until it is paged back in, so a miss means
          // "scroll and look again", not "gone".
          revealWithSearch(flow, annotation).then((range) => {
            if (range === null) {
              setNotice(diagnoseMiss(findFlow(), annotation))
              return
            }
            // The registry keeps the glow on the text from here on, so scrolling
            // or a later reflow cannot leave it stranded.
            flashRange(range)
          }, (failure) => {
            console.error('[dsh-quote-chat] jump failed:', failure)
            setNotice(diagnoseMiss(findFlow(), annotation))
          })
        }, [])

        /**
         * Jump by chip id, the form the reference source receives.
         *
         * The source is registered once per plugin while annotations are
         * per-session, so it cannot hold a closure over this session's list; it
         * calls through this published handler instead.
         * @param ref - the chip's annotation id.
         * @returns whether an annotation with that id was found.
         */
        React.useEffect(() => {
          chipJumpHandler.current = (ref) => {
            const match = annotations.find((item) => item.id === ref)
            if (match === undefined) return false
            onJump(match)
            return true
          }
          return () => {
            if (chipJumpHandler.current !== null) chipJumpHandler.current = null
          }
        }, [annotations, onJump])

        const onRemove = React.useCallback((annotation) => {
          if (sessionId === undefined) return
          // Removing the annotation removes its chip, and any prose the user
          // typed after that chip stays: only the chip and its comment line go.
          const snapshot = withoutChip(
            typeof draft === 'string' ? draft : '',
            Array.isArray(inputStateRef.current?.occurrences) ? inputStateRef.current.occurrences : [],
            annotation.id,
          )
          if (snapshot !== null && typeof inputActions?.setDraft === 'function') {
            inputActions.setDraft(snapshot)
          }
          removeAnnotation(sessionId, annotation.id)
        }, [draft, inputActions, sessionId])

        const onAsk = React.useCallback((source) => {
          const opener = ctx.get('sidebarRight')
          if (typeof opener?.openTab !== 'function') return
          pendingQuote.text = source.text
          pendingQuote.at = Date.now()
          try {
            opener.openTab(TAB_KIND, {
              params: { quote: source.text, title: t('side.title') },
              revealIfOpened: true,
            })
          } catch (failure) {
            console.error('[dsh-quote-chat] side-chat open failed:', failure)
            setNotice(labels.unavailable)
            return
          }
          setOverlay(null)
          clearSelection()
        }, [ctx, labels, t])

        const canAnnotate = typeof inputActions?.setDraft === 'function'
          || (typeof inputActions?.captureInsertion === 'function'
            && typeof inputActions?.insertText === 'function')
        const canAsk = typeof ctx.get('sidebarRight')?.openTab === 'function'

        return h(React.Fragment, null,
          overlay === null ? null : overlay.kind === 'actions'
            ? h(ActionPopup, {
              anchor: overlay.source.rect,
              canAnnotate,
              canAsk,
              labels,
              onAnnotate: () => setOverlay({ kind: 'compose', source: overlay.source }),
              onAsk: () => onAsk(overlay.source),
            })
            : h(ComposerPopover, {
              source: overlay.source,
              labels,
              onConfirm: (comment) => commit(overlay.source, comment),
              onCancel: () => setOverlay(null),
            }),
          h(ChipCards, { annotations, occurrences, labels, onJump, onRemove }),
          h(MarkerLayer, { annotations, labels, onJump }),
          h(TableAddButton, { label: labels.tableAdd, onAdd: annotateTable }),
          notice === '' ? null : h('div', { className: 'qc-notice' }, notice),
        )
      }
    }

    // #endregion

    // #region apply

    /**
     * Browser plugin body.
     * @param ctx - Client context.
     */
    function apply(ctx) {
      installStyles(ctx)
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'quote-chat: dictionaries')
      const t = ctx.locale.bind(NS)

      // The side-chat tab type. Optional: a host without the right Sidebar keeps
      // the annotation workflow and disables the other action.
      ctx.effect(() => {
        const handle = ctx.inject(['sidebarRightTabs'], (scope) => {
          const tabs = scope.sidebarRightTabs
          if (tabs === undefined || typeof tabs.register !== 'function') return
          const disposers = []
          try {
            disposers.push(tabs.register({
              id: TAB_ID,
              kind: TAB_KIND,
              title: () => t('side.title'),
              guide: [{
                id: 'quote-chat',
                order: 55,
                title: () => t('side.title'),
                description: () => t('side.guide'),
              }],
            }))
            disposers.push(scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register({
              name: 'sidebar.right.pane.tab',
              key: TAB_ID,
              locale: NS,
              inject: () => ({ pluginCtx: ctx }),
            }, SideChatTab)))
          } catch (error) {
            for (const dispose of disposers.splice(0)) dispose()
            console.error('[dsh-quote-chat] right-sidebar registration failed:', error)
            return undefined
          }
          return () => { for (const dispose of disposers.splice(0)) dispose() }
        })
        const release = typeof handle === 'function' ? handle : handle?.dispose?.bind(handle)
        return () => { if (typeof release === 'function') release() }
      }, 'quote-chat: side-chat tab type')

      // The reference source. This is what makes an annotation a chip rather
      // than stray text: the framework calls `codec.serialize` on submit to turn
      // the chip into the model's copy of the passage, and `openReference` when
      // the chip is clicked. Both bug reports — "clicking does nothing" and "the
      // content sits outside the card" — came from this registration not
      // existing: without it a chip is an inert token with no owner.
      ctx.effect(() => {
        const handle = ctx.inject(['inputTriggers'], (scope) => {
          const registry = scope.inputTriggers
          if (registry === undefined || typeof registry.registerSource !== 'function') return undefined
          return registry.registerSource({
            trigger: CHIP_TRIGGER,
            name: CHIP_SOURCE,
            openReference(_session, reference) {
              const jump = chipJumpHandler.current
              if (typeof jump !== 'function') return false
              // The chip knows which annotation it is; the dock knows where that
              // annotation's passage sits in the flow.
              return jump(reference?.ref) === true
            },
            codec: {
              clipboardText: () => CHIP_PLACEHOLDER,
              serialize(ref) {
                const payload = chipPayloads.get(ref)
                if (payload === undefined) {
                  return Promise.reject(new Error(`quote-chat: unknown chip "${ref}"`))
                }
                return Promise.resolve(serializeChipForModel(payload))
              },
            },
          })
        })
        const release = typeof handle === 'function' ? handle : handle?.dispose?.bind(handle)
        return () => { if (typeof release === 'function') release() }
      }, 'quote-chat: reference source')

      // The annotation strip and its floating surfaces.
      ctx.effect(() => {
        const release = ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'quote-chat-annotations',
          order: 15,
          locale: NS,
        }, annotationDock({ ctx, t })))
        return () => { if (typeof release === 'function') release() }
      }, 'quote-chat: annotation dock')
    }

    // #endregion

    return {
      inject: ['slots', 'locale'],
      apply,
    }
  },
})
