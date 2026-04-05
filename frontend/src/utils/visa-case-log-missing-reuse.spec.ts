import { describe, expect, it } from 'vitest'

import { pickVisaCaseLogForMissingItemsReuse } from './visa-case-log-missing-reuse'

describe('pickVisaCaseLogForMissingItemsReuse', () => {
  it('returns null for empty list', () => {
    expect(pickVisaCaseLogForMissingItemsReuse([])).toBeNull()
  })

  it('in create mode picks first item with missing items (newest)', () => {
    const items = [
      { id: '1', missingItems: '' },
      { id: '2', missingItems: 'A' },
      { id: '3', missingItems: 'B' },
    ]
    expect(pickVisaCaseLogForMissingItemsReuse(items)?.id).toBe('2')
  })

  it('in edit mode picks next older log with missing items', () => {
    const items = [
      { id: 'new', missingItems: 'current' },
      { id: 'mid', missingItems: '' },
      { id: 'old', missingItems: 'reuse me' },
    ]
    expect(pickVisaCaseLogForMissingItemsReuse(items, 'new')?.id).toBe('old')
  })

  it('when editing newest without missing, still finds older', () => {
    const items = [
      { id: 'new', missingItems: '' },
      { id: 'old', missingItems: 'x' },
    ]
    expect(pickVisaCaseLogForMissingItemsReuse(items, 'new')?.missingItems).toBe('x')
  })

  it('returns null when no older log has missing items', () => {
    const items = [
      { id: 'a', missingItems: 'only' },
      { id: 'b', missingItems: '' },
    ]
    expect(pickVisaCaseLogForMissingItemsReuse(items, 'a')).toBeNull()
  })
})
