import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getFillerColumnCount, JournalTable } from '../JournalTable'
import { type JournalData } from '../../../../types/journal'

function makeJournalData(dates: string[]): JournalData {
  const grades: JournalData['grades'] = {}
  for (const student of [{ id: 'st1', name: 'Петров' }]) {
    grades[student.id] = Object.fromEntries(dates.map((date) => [date, 5]))
  }
  return {
    classId: 'c1',
    className: '5А',
    subject: 'Математика',
    subjectId: 's1',
    subjects: [],
    dates,
    students: [{ id: 'st1', name: 'Петров' }],
    grades,
  }
}

describe('JournalTable scroll', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-27T12:00:00'))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('при догрузке старых дат не повторяет автоскролл к сегодняшней колонке', async () => {
    const initialDates = [
      ...Array.from({ length: 11 }, (_, index) => {
        const day = String(10 + index).padStart(2, '0')
        return `2026-03-${day}`
      }),
      '2026-03-27',
    ]

    const onScrollPositionRestored = vi.fn()

    const { rerender } = render(
      <JournalTable
        data={makeJournalData(initialDates)}
        onScrollPositionRestored={onScrollPositionRestored}
      />,
    )

    await act(async () => {})

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    })

    const olderDates = ['2026-03-01', '2026-03-02', '2026-03-03']
    const prependedDates = [...olderDates, ...initialDates]

    await act(async () => {
      rerender(
        <JournalTable
          data={makeJournalData(prependedDates)}
          prependedColumnsCount={olderDates.length}
          onScrollPositionRestored={onScrollPositionRestored}
        />,
      )
    })

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(onScrollPositionRestored).toHaveBeenCalledTimes(1)
  })
})

describe('getFillerColumnCount', () => {
  it('Given wide container and few date columns When calculating Then returns filler count', () => {
    expect(getFillerColumnCount(1200, 220, 10, false)).toBe(7)
  })

  it('Given few dates mode When calculating Then returns zero fillers', () => {
    expect(getFillerColumnCount(1200, 220, 5, true)).toBe(0)
  })
})

describe('JournalTable filler columns', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-27T12:00:00'))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('Given table narrower than container When rendered Then adds inactive filler cells', async () => {
    const dates = Array.from({ length: 10 }, (_, index) => {
      const day = String(10 + index).padStart(2, '0')
      return `2026-03-${day}`
    })

    const { container } = render(<JournalTable data={makeJournalData(dates)} />)
    const scrollContainer = container.querySelector('.max-h-\\[70dvh\\]') as HTMLDivElement
    Object.defineProperty(scrollContainer, 'clientWidth', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(scrollContainer, 'scrollWidth', {
      configurable: true,
      value: 1200,
    })

    await act(async () => {
      fireEvent(window, new Event('resize'))
    })

    await waitFor(() => {
      expect(container.querySelectorAll('th[aria-hidden="true"]').length).toBeGreaterThan(0)
      expect(container.querySelectorAll('td[aria-hidden="true"]').length).toBeGreaterThan(0)
    })
  })
})

describe('JournalTable shift wheel scroll', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-27T12:00:00'))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('Given shift held When wheel over table Then scrolls horizontally', async () => {
    const dates = Array.from({ length: 20 }, (_, index) => {
      const day = String(index + 1).padStart(2, '0')
      return `2026-03-${day}`
    })

    const { container } = render(<JournalTable data={makeJournalData(dates)} />)
    const scrollContainer = container.querySelector('.max-h-\\[70dvh\\]') as HTMLDivElement
    Object.defineProperty(scrollContainer, 'clientWidth', {
      configurable: true,
      value: 800,
    })
    Object.defineProperty(scrollContainer, 'scrollWidth', {
      configurable: true,
      value: 1600,
    })
    scrollContainer.scrollLeft = 0

    await act(async () => {
      fireEvent(window, new Event('resize'))
    })

    await act(async () => {
      scrollContainer.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 120, shiftKey: true, bubbles: true, cancelable: true }),
      )
    })

    expect(scrollContainer.scrollLeft).toBe(120)
  })
})
