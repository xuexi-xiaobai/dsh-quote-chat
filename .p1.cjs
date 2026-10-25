const fs = require('fs')
const f = 'D:/Win自带分类文件夹/桌面/各种乱七八糟的项目/deepseekharness插件/dsh-quote-chat/client.js'
let s = fs.readFileSync(f, 'utf8')

const oldBlock = [
  '        const flow = findFlow()',
  '        const box = (row !== undefined && row !== null && row.isConnected)',
  '          ? row.getBoundingClientRect()',
  '          : null',
  '        // Opened ABOVE the passage so the annotated text stays readable underneath.',
  '        const anchored = flow === null || box === null',
  '          ? null',
  '          : anchorInTranscript(',
  '            flow, box,',
  '            { width: BUBBLE_PANEL_WIDTH, height: BUBBLE_PANEL_HEIGHT },',
  '            \'above\',',
  '          )',
].join('\n')

const newBlock = [
  '        const flow = findFlow()',
  '        // Anchor to the BUBBLE, not to the paragraph: the panel must line up with the',
  '        // marker the user just clicked. Its right edge is flush with the bubble\'s right',
  '        // edge, and its bottom clears the bubble\'s top by a fixed gap. Because both',
  '        // offsets are derived from the bubble\'s own box, the panel travels with the',
  '        // marker as the transcript scrolls - no scroll listener is involved.',
  '        const bubble = (row !== undefined && row !== null && row.isConnected)',
  '          ? row.querySelector(\'.qc-marker[data-qc-number="\' + String(editing.position ?? \'\') + \'"]\')',
  '            ?? row.querySelector(\'.qc-marker\')',
  '          : null',
  '        const box = bubble === null || bubble === undefined',
  '          ? (row !== undefined && row !== null && row.isConnected ? row.getBoundingClientRect() : null)',
  '          : bubble.getBoundingClientRect()',
  '        const anchored = flow === null || box === null',
  '          ? null',
  '          : anchorAboveBubble(flow, box, {',
  '            width: BUBBLE_PANEL_WIDTH,',
  '            height: panelSize?.height ?? BUBBLE_PANEL_HEIGHT,',
  '          })',
].join('\n')

if (!s.includes(oldBlock)) throw new Error('panel anchor block not found')
s = s.replace(oldBlock, newBlock)

fs.writeFileSync(f, s)
console.log('panel now anchors to the bubble')
