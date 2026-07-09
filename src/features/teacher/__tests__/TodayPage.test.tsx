import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatSelectedScheduleDay } from '../scheduleDayFormat'

describe('formatSelectedScheduleDay', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Given selected day is today When formatting Then shows current time not midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T13:45:00'))

    const weekStart = new Date('2026-07-06T00:00:00')
    const title = formatSelectedScheduleDay(weekStart, 4, new Date())

    expect(title).toMatch(/13:45/)
    expect(title).not.toMatch(/00:00/)
  })

  it('Given selected day is not today When formatting Then omits time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T13:45:00'))

    const weekStart = new Date('2026-07-06T00:00:00')
    const title = formatSelectedScheduleDay(weekStart, 0, new Date())

    expect(title).not.toMatch(/\d{2}:\d{2}/)
  })
})
