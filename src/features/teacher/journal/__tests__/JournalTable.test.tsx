import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { JournalTable } from '../JournalTable'
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
