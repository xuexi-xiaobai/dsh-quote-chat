/**
 * Locale dictionaries for this package.
 *
 * Both languages are declared here and registered together in `apply`. They must stay keyed
 * identically: a key present in one and missing from the other reaches the screen as raw
 * jargon, which survives review. `test/locale-parity.mjs` enforces that, and also checks that
 * every literal `t('…')` call in the source resolves to a real key.
 *
 * What this module does NOT do: choose a language, format numbers, or interpolate
 * placeholders. Selection is the locale service's job and interpolation belongs to the
 * caller via `t(key, params)`.
 */

    /** Simplified Chinese dictionary. */
    export const zh = {
      'popup.annotate': '添加注释',
      'popup.askInSide': '在侧边聊天中提问',
      'popup.tooLong': '选中的内容太长（最多 {max} 字）',
      'popup.unavailable': '这段内容无法写入输入框',

      'compose.title': '添加注释',
      'compose.placeholder': '写下你的评价，可留空…',
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

      'bubble.edit': '编辑注释',
      'bubble.comment': '评价',
      'bubble.saved': '已保存',
      'bubble.deleted': '已删除',
      'bubble.placeholder': '补充这条注释的说明…',
      'bubble.save': '保存',
      'bubble.delete': '删除',

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
    export const en = {
      'popup.annotate': 'Add annotation',
      'popup.askInSide': 'Ask in side chat',
      'popup.tooLong': 'Selection is too long (max {max} characters)',
      'popup.unavailable': 'This passage cannot be written into the composer',

      'compose.title': 'Add annotation',
      'compose.placeholder': 'Add your evaluation, or leave it blank…',
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

      'bubble.edit': 'Edit annotation',
      'bubble.comment': 'Comment',
      'bubble.saved': 'Saved',
      'bubble.deleted': 'Deleted',
      'bubble.placeholder': 'Add a note about this annotation…',
      'bubble.save': 'Save',
      'bubble.delete': 'Delete',

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

