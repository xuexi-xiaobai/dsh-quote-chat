import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

// Regression: the hover card's follow loop re-measures the chip on every frame while the card is open.
// Its geometry helper must not be scoped inside the sibling onPointer handler.
const source = readFileSync(new URL('../src/ui/cards.js', import.meta.url), 'utf8')
const helper = /^const snap = \(value\) => Math\.round\(value \* 100\) \/ 100$/gm
assert.equal([...source.matchAll(helper)].length, 1, 'snap must be defined once at module scope')
assert.match(source, /const follow = \(\) => \{[\s\S]*?left: snap\(rect\.left\)/)
assert.match(source, /const onPointer = [\s\S]*?snap\(rect\.left\)/)
console.log('PASS chip hover and the follow loop share the geometry helper')
