import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PendingMember } from './types'
import { rollbackWizardInlineCustomers } from './visaCaseWizardRollback'

vi.mock('@/api/customer', () => ({
  deleteCustomer: vi.fn((): Promise<{ code: number }> => Promise.resolve({ code: 0 })),
}))

import { deleteCustomer } from '@/api/customer'

describe('rollbackWizardInlineCustomers', () => {
  beforeEach(() => {
    vi.mocked(deleteCustomer).mockClear()
  })

  it('仅对 createdViaWizardInline 为 true 的行调用 deleteCustomer', async () => {
    const members: PendingMember[] = [
      {
        tempId: 1,
        customerId: 'inline-1',
        memberRole: 'SPOUSE',
        displayNameSnapshot: 'A',
        createdViaWizardInline: true,
      },
      {
        tempId: 2,
        customerId: 'existing-2',
        memberRole: 'CHILD',
        displayNameSnapshot: 'B',
      },
    ]
    await rollbackWizardInlineCustomers(members)
    expect(deleteCustomer).toHaveBeenCalledTimes(1)
    expect(deleteCustomer).toHaveBeenCalledWith('inline-1')
  })
})
