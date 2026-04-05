import { describe, expect, it } from 'vitest'

import { appendTextBlock } from './append-text-block'

describe('appendTextBlock', () => {
  it('returns addition only when existing is blank', () => {
    expect(appendTextBlock('', '  hello  ')).toBe('hello')
    expect(appendTextBlock('   ', 'x')).toBe('x')
  })

  it('returns existing when addition is blank', () => {
    expect(appendTextBlock('a', '')).toBe('a')
    expect(appendTextBlock('a', '   ')).toBe('a')
  })

  it('joins two non-empty blocks with a blank line', () => {
    expect(appendTextBlock('line1', 'line2')).toBe('line1\n\nline2')
    expect(appendTextBlock('  line1  ', '  line2  ')).toBe('line1\n\nline2')
  })
})
