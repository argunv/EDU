import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInitialJournalRange, getOlderBlockRange } from './journalPeriod'

describe('getInitialJournalRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 14 inclusive local days ending today', () => {
    const { fromDate, toDate } = getInitialJournalRange()
    expect(toDate).toBe('2026-06-15')
    expect(fromDate).toBe('2026-06-02')
  })
})

describe('getOlderBlockRange', () => {
  it('returns 14 days ending the day before anchor', () => {
    const { fromDate, toDate } = getOlderBlockRange('2026-04-15')
    expect(toDate).toBe('2026-04-14')
    expect(fromDate).toBe('2026-04-01')
  })

  it('throws on invalid YMD', () => {
    expect(() => getOlderBlockRange('')).toThrow(RangeError)
    expect(() => getOlderBlockRange('2026-02-31')).toThrow(RangeError)
  })
})
