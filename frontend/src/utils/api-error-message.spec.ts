import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'

import { pickApiErrorMessage } from './api-error-message'

describe('pickApiErrorMessage', () => {
  it('returns response.data.message for AxiosError when present', () => {
    const err = new AxiosError('req failed')
    err.response = {
      data: { message: '权限不足' },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    }
    expect(pickApiErrorMessage(err)).toBe('权限不足')
  })

  it('falls back to AxiosError.message when body has no message', () => {
    expect(pickApiErrorMessage(new AxiosError('network down'))).toBe('network down')
  })

  it('returns Error.message for generic Error', () => {
    expect(pickApiErrorMessage(new Error('x'))).toBe('x')
  })

  it('returns empty string for null', () => {
    expect(pickApiErrorMessage(null)).toBe('')
  })
})
