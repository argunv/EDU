import { describe, expect, it } from 'vitest'

import { getApiErrorMessage } from './errors'

describe('errors', () => {
  it('getApiErrorMessage extracts detail from axios-like error', () => {
    const err = { response: { data: { detail: 'Неверный текущий пароль' } } }
    expect(getApiErrorMessage(err, 'fallback')).toBe('Неверный текущий пароль')
  })

  it('getApiErrorMessage falls back for unknown errors', () => {
    expect(getApiErrorMessage(new Error('network'), 'Ошибка')).toBe('network')
    expect(getApiErrorMessage(null, 'Ошибка')).toBe('Ошибка')
  })
})
