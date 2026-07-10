import { describe, expect, it } from 'vitest'

import {
  formatDateTime,
  formatProfileDate,
  getCurrentSemester,
  getCurrentYearStart,
  getProfileValue,
  ROLE_LABELS,
} from '../profileUtils'

describe('profileUtils', () => {
  it('getProfileValue returns placeholder for empty values', () => {
    expect(getProfileValue(null)).toBe('Не указано')
    expect(getProfileValue('  ')).toBe('Не указано')
    expect(getProfileValue('value')).toBe('value')
  })

  it('formatProfileDate formats ISO date', () => {
    expect(formatProfileDate('2012-03-15')).toBe('15.03.2012')
    expect(formatProfileDate(null)).toBe('Не указано')
  })

  it('formatDateTime returns readable ru string or placeholder', () => {
    expect(formatDateTime(null)).toBe('Не указано')
    expect(formatDateTime('2026-03-01T10:30:00Z')).toMatch(/\d{2}\.\d{2}\.\d{4}/)
  })

  it('getCurrentSemester returns 1 or 2', () => {
    expect([1, 2]).toContain(getCurrentSemester())
  })

  it('getCurrentYearStart returns reasonable year', () => {
    const year = getCurrentYearStart()
    expect(year).toBeGreaterThan(2000)
    expect(year).toBeLessThan(2100)
  })

  it('ROLE_LABELS contains all approved roles', () => {
    expect(ROLE_LABELS.admin).toBe('Администратор')
    expect(ROLE_LABELS.teacher).toBe('Учитель')
    expect(ROLE_LABELS.student).toBe('Ученик')
    expect(ROLE_LABELS.parent).toBe('Родитель')
  })
})
