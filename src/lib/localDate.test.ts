import { describe, expect, it } from 'vitest'

import { formatLocalDateYmd, parseLocalYmdToDate } from './localDate'

describe('formatLocalDateYmd', () => {
  it('formats local calendar date as YYYY-MM-DD with zero padding', () => {
    expect(formatLocalDateYmd(new Date(2026, 3, 7))).toBe('2026-04-07')
    expect(formatLocalDateYmd(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(formatLocalDateYmd(new Date(2026, 8, 5))).toBe('2026-09-05')
  })
})

describe('parseLocalYmdToDate', () => {
  it('parses YYYY-MM-DD as local calendar day', () => {
    const d = parseLocalYmdToDate('2026-04-07')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(3)
    expect(d!.getDate()).toBe(7)
  })

  it('round-trips with formatLocalDateYmd', () => {
    const original = new Date(2026, 10, 30)
    expect(parseLocalYmdToDate(formatLocalDateYmd(original))!.getTime()).toBe(
      new Date(2026, 10, 30).getTime()
    )
  })

  it('returns null for invalid input', () => {
    expect(parseLocalYmdToDate('')).toBeNull()
    expect(parseLocalYmdToDate('2026-13-01')).toBeNull()
    expect(parseLocalYmdToDate('2026-02-31')).toBeNull()
    expect(parseLocalYmdToDate('not-a-date')).toBeNull()
  })
})
