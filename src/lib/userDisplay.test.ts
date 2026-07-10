import { describe, expect, it } from 'vitest'

import { getInitials } from './userDisplay'

describe('userDisplay', () => {
  it('getInitials returns ? for empty name', () => {
    expect(getInitials(null)).toBe('?')
    expect(getInitials('')).toBe('?')
  })

  it('getInitials uses first letter for single word', () => {
    expect(getInitials('Иван')).toBe('И')
  })

  it('getInitials uses first letters of last and first name', () => {
    expect(getInitials('Иванов Петр')).toBe('ИП')
  })
})
