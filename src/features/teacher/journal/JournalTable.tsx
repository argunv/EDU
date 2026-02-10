import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { JournalAverageCell } from './JournalAverageCell'
import { JournalCell } from './JournalCell'
import { JournalHeaderCell } from './JournalHeaderCell'
import { type JournalData, type JournalGrade } from '../../../types/journal'

type JournalTableProps = {
  data: JournalData
  readOnly?: boolean
  hideNull?: boolean
  header?: ReactNode
  onSaveGrade?: (studentId: string, dateISO: string, value: JournalGrade) => void | Promise<void>
  cornerLabel?: string | null
  /** Вызывается при достижении левой границы (scrollLeft === 0) — для догрузки более старых дат */
  onReachLeftEdge?: () => void
  /** После мержа данных: число колонок, добавленных слева; таблица компенсирует скролл и вызывает onScrollPositionRestored */
  prependedColumnsCount?: number
  onScrollPositionRestored?: () => void
  isLoadingMore?: boolean
}

type ActiveCell = { studentId: string; date: string } | null

const DATE_COLUMNS_FEW_THRESHOLD = 8
const DATE_COLUMN_MIN_WIDTH_PX = 56
const NAME_COLUMN_MIN_WIDTH_PX = 220
const NAME_COLUMN_MAX_WIDTH_PX = 420
const NAME_COLUMN_PX_PER_CHAR = 8
const NAME_COLUMN_PADDING_PX = 32
const AVERAGE_COLUMN_WIDTH_PX = 56

function formatHeaderLabels(dates: string[]) {
  const dayFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' })
  const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'short' })
  let lastMonth = ''
  return dates.map((date) => {
    const parsed = new Date(date)
    const month = monthFormatter.format(parsed).replace('.', '').toUpperCase()
    const showMonth = month !== lastMonth
    lastMonth = month
    return {
      day: dayFormatter.format(parsed),
      monthLabel: showMonth ? month : undefined,
    }
  })
}

function getAverage(grades: JournalGrade[]) {
  const numeric = grades
    .filter((g) => g !== 'Н' && g != null)
    .map((g) => (typeof g === 'number' ? g : Number(g)))
    .filter((n) => !Number.isNaN(n))
  if (numeric.length === 0) return '—'
  const raw = numeric.reduce((sum, value) => sum + value, 0) / numeric.length
  const rounded = Math.ceil(raw * 100) / 100
  return rounded.toFixed(2)
}

export function JournalTable({
  data,
  readOnly = false,
  hideNull = false,
  header,
  onSaveGrade,
  cornerLabel,
  onReachLeftEdge,
  prependedColumnsCount = 0,
  onScrollPositionRestored,
  isLoadingMore = false,
}: JournalTableProps) {
  const [activeCell, setActiveCell] = useState<ActiveCell>(null)
  const [lastEditedCell, setLastEditedCell] = useState<ActiveCell>(null)
  const [draftValue, setDraftValue] = useState<JournalGrade>(null)
  const draftValueRef = useRef<JournalGrade>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [hoveredColIndex, setHoveredColIndex] = useState<number | null>(null)
  const [grades, setGrades] = useState(() => data.grades)
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayColumnRef = useRef<HTMLTableCellElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const leftEdgeFiredRef = useRef(false)

  const headerLabels = useMemo(() => formatHeaderLabels(data.dates), [data.dates])
  const isFewDates = data.dates.length <= DATE_COLUMNS_FEW_THRESHOLD
  const nameColumnWidthPx = useMemo(() => {
    const maxNameLength =
      data.students.length === 0
        ? 0
        : Math.max(...data.students.map((s) => s.name.length))
    const fromContent =
      maxNameLength * NAME_COLUMN_PX_PER_CHAR + NAME_COLUMN_PADDING_PX
    return Math.min(
      NAME_COLUMN_MAX_WIDTH_PX,
      Math.max(NAME_COLUMN_MIN_WIDTH_PX, fromContent)
    )
  }, [data.students])
  const todayISO = useMemo(
    () =>
      new Date().getFullYear() +
      '-' +
      String(new Date().getMonth() + 1).padStart(2, '0') +
      '-' +
      String(new Date().getDate()).padStart(2, '0'),
    []
  )
  const todayIndex = useMemo(
    () => data.dates.indexOf(todayISO),
    [data.dates, todayISO]
  )

  useEffect(() => {
    setGrades(data.grades)
  }, [data.grades])

  useEffect(() => {
    // Убираем подсветку hover при смене активной ячейки (клавиатура).
    setHoveredRowId(null)
    setHoveredColIndex(null)
  }, [activeCell])

  useEffect(() => {
    draftValueRef.current = draftValue
  }, [draftValue])
  const averages = useMemo(() => {
    return data.students.reduce<Record<string, string>>((acc, student) => {
      const studentGrades = data.dates.map((date) => grades[student.id]?.[date] ?? null)
      acc[student.id] = getAverage(studentGrades)
      return acc
    }, {})
  }, [data.dates, data.students, grades])

  const updateScrollState = () => {
    const container = scrollRef.current
    if (!container) return
    const sl = container.scrollLeft
    const hasOverflow = container.scrollWidth > container.clientWidth + 1
    setIsOverflowing(hasOverflow)
    setCanScrollLeft(sl > 0)
    setCanScrollRight(sl + container.clientWidth < container.scrollWidth - 1)
    if (sl > 5) leftEdgeFiredRef.current = false
    if (sl <= 2 && onReachLeftEdge && !leftEdgeFiredRef.current && !isLoadingMore) {
      leftEdgeFiredRef.current = true
      onReachLeftEdge()
    }
  }

  useEffect(() => {
    updateScrollState()
    const container = scrollRef.current
    if (!container) return

    const handleScroll = () => updateScrollState()
    const handleResize = () => updateScrollState()

    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [data.dates.length, data.students.length, onReachLeftEdge, isLoadingMore])

  useEffect(() => {
    if (prependedColumnsCount <= 0 || !scrollRef.current || !onScrollPositionRestored) return
    const width = prependedColumnsCount * DATE_COLUMN_MIN_WIDTH_PX
    const id = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = width
        onScrollPositionRestored()
      }
    })
    return () => cancelAnimationFrame(id)
  }, [prependedColumnsCount, onScrollPositionRestored])

  useEffect(() => {
    if (todayIndex < 0 || !todayColumnRef.current) return
    const el = todayColumnRef.current
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'end' })
    })
    return () => cancelAnimationFrame(id)
  }, [data.dates.length, todayIndex, data.classId, data.subjectId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const resolveRowIndex = () => {
        if (activeCell) {
          return data.students.findIndex((student) => student.id === activeCell.studentId)
        }
        if (lastEditedCell) {
          return data.students.findIndex((student) => student.id === lastEditedCell.studentId)
        }
        if (hoveredRowId) {
          return data.students.findIndex((student) => student.id === hoveredRowId)
        }
        return 0
      }

      const resolveColIndex = () => {
        if (activeCell) {
          return data.dates.findIndex((date) => date === activeCell.date)
        }
        if (lastEditedCell) {
          return data.dates.findIndex((date) => date === lastEditedCell.date)
        }
        if (hoveredColIndex !== null) {
          return hoveredColIndex
        }
        return 0
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault()
        const rowIndex = resolveRowIndex()
        const colIndex = resolveColIndex()
        if (rowIndex === -1 || colIndex === -1) return

        let nextRow = rowIndex
        let nextCol = colIndex

        if (event.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1)
        if (event.key === 'ArrowDown')
          nextRow = Math.min(data.students.length - 1, rowIndex + 1)
        if (event.key === 'ArrowLeft') nextCol = Math.max(0, colIndex - 1)
        if (event.key === 'ArrowRight') nextCol = Math.min(data.dates.length - 1, colIndex + 1)

        const nextStudentId = data.students[nextRow]?.id
        const nextDate = data.dates[nextCol]
        if (!nextStudentId || !nextDate) return
        setActiveCell({ studentId: nextStudentId, date: nextDate })
        const nextValue = grades[nextStudentId]?.[nextDate] ?? null
        draftValueRef.current = nextValue
        setDraftValue(nextValue)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setActiveCell(null)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        void handleSave()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        if (!activeCell) return
        const currentIndex = data.students.findIndex(
          (student) => student.id === activeCell.studentId,
        )
        const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1
        if (nextIndex < 0 || nextIndex >= data.students.length) return
        const nextStudentId = data.students[nextIndex].id
        const currentDate = activeCell.date
        void handleSaveAndMove({ studentId: nextStudentId, date: currentDate })
        return
      }

      if (!['2', '3', '4', '5'].includes(event.key)) return
      event.preventDefault()
      const nextValue = Number(event.key) as 2 | 3 | 4 | 5
      draftValueRef.current = nextValue
      setDraftValue(nextValue)
    }

    if (!readOnly) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeCell, readOnly, data.students, data.dates, grades, hoveredRowId, hoveredColIndex])

  const handleOpen = (studentId: string, date: string) => {
    if (readOnly) return
    if (activeCell?.studentId === studentId && activeCell?.date === date) {
      setActiveCell(null)
      return
    }
    setActiveCell({ studentId, date })
    const current = grades[studentId]?.[date] ?? null
    draftValueRef.current = current
    setDraftValue(current)
  }

  const handleSave = async () => {
    if (readOnly || !activeCell) return
    const valueToSave = draftValueRef.current
    // Моки: сохраняем локально в UI-стейте таблицы.
    setGrades((prev) => ({
      ...prev,
      [activeCell.studentId]: {
        ...prev[activeCell.studentId],
        [activeCell.date]: valueToSave,
      },
    }))
    try {
      if (onSaveGrade) {
        await onSaveGrade(activeCell.studentId, activeCell.date, valueToSave)
      }
    } finally {
      setLastEditedCell(activeCell)
      setActiveCell(null)
    }
  }

  const handleSaveAndMove = async (nextCell: { studentId: string; date: string }) => {
    if (readOnly || !activeCell) return
    const valueToSave = draftValueRef.current
    setGrades((prev) => ({
      ...prev,
      [activeCell.studentId]: {
        ...prev[activeCell.studentId],
        [activeCell.date]: valueToSave,
      },
    }))
    try {
      if (onSaveGrade) {
        await onSaveGrade(activeCell.studentId, activeCell.date, valueToSave)
      }
    } finally {
      setLastEditedCell(activeCell)
      const nextValue = grades[nextCell.studentId]?.[nextCell.date] ?? null
      draftValueRef.current = nextValue
      setDraftValue(nextValue)
      setActiveCell(nextCell)
    }
  }

  const scrollByAmount = (direction: -1 | 1) => {
    const container = scrollRef.current
    if (!container) return
    if (direction === -1 && container.scrollLeft <= 0 && onReachLeftEdge && !isLoadingMore) {
      leftEdgeFiredRef.current = true
      onReachLeftEdge()
      return
    }
    const amount = Math.round(container.clientWidth * 0.8) * direction
    container.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <section className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
      {header ? <div className="sticky top-0 z-30 bg-white shadow-sm">{header}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-600 dark:bg-zinc-700/60">
        {isOverflowing ? (
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Можно листать влево/вправо →</div>
        ) : (
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Листание по датам</div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            disabled={!canScrollLeft && !(onReachLeftEdge && !isLoadingMore)}
            className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-zinc-500 dark:bg-zinc-700 dark:text-slate-100"
          >
            {isLoadingMore ? 'Загрузка…' : '◀ Влево'}
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            disabled={!canScrollRight}
            className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-zinc-500 dark:bg-zinc-700 dark:text-slate-100"
          >
            Вправо ▶
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[70dvh] overflow-auto">
        <table
          className={
            isFewDates
              ? 'w-full table-fixed border-collapse text-left'
              : 'w-max border-collapse text-left'
          }
        >
          <colgroup>
            <col style={{ width: `${nameColumnWidthPx}px` }} />
            {data.dates.map((date) => (
              <col
                key={date}
                style={{
                  width: isFewDates
                    ? `max(${DATE_COLUMN_MIN_WIDTH_PX}px, calc((100% - ${nameColumnWidthPx + AVERAGE_COLUMN_WIDTH_PX}px) / ${data.dates.length}))`
                    : `${DATE_COLUMN_MIN_WIDTH_PX}px`,
                }}
              />
            ))}
            <col style={{ width: `${AVERAGE_COLUMN_WIDTH_PX}px` }} />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-white shadow-sm">
            <tr>
              <th
                className="sticky left-0 z-30 border-b border-r border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900"
                style={{
                  width: nameColumnWidthPx,
                  minWidth: NAME_COLUMN_MIN_WIDTH_PX,
                  maxWidth: NAME_COLUMN_MAX_WIDTH_PX,
                }}
              >
                {cornerLabel === undefined ? `${data.className} • ${data.subject}` : cornerLabel}
              </th>
              {headerLabels.map((header, index) => (
                <JournalHeaderCell
                  key={`${data.dates[index]}-${header.day}`}
                  ref={index === todayIndex ? todayColumnRef : undefined}
                  day={header.day}
                  monthLabel={header.monthLabel}
                  flexible={isFewDates}
                />
              ))}
              <th className="sticky right-0 z-20 border-b border-l border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-red-600">
                <div className="flex h-16 items-center justify-center">
                  <span className="-rotate-90">Средняя</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((student, rowIndex) => {
              const rowBg =
                rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900'
              return (
                <tr
                  key={student.id}
                  className={rowBg}
                  onMouseLeave={() => {
                    setHoveredRowId(null)
                    setHoveredColIndex(null)
                  }}
                >
                  <th
                    className="sticky left-0 z-10 border-r border-slate-200 bg-inherit px-3 py-2 text-left text-sm font-semibold text-slate-900"
                    style={{
                      width: nameColumnWidthPx,
                      minWidth: NAME_COLUMN_MIN_WIDTH_PX,
                      maxWidth: NAME_COLUMN_MAX_WIDTH_PX,
                    }}
                  >
                    <div className="truncate">{student.name}</div>
                  </th>
                  {data.dates.map((date, colIndex) => {
                    const value = grades[student.id]?.[date] ?? null
                    const isActive =
                      activeCell?.studentId === student.id && activeCell?.date === date
                    const hasActive = Boolean(activeCell)
                    const isRowHovered = hoveredRowId === student.id
                    const isColHovered = hoveredColIndex === colIndex
                    const isRowActive = activeCell?.studentId === student.id
                    const isColActive = activeCell?.date === date
                    const openUpwards = rowIndex >= data.students.length - 3
                    return (
                      <td
                        key={date}
                        className="h-12 border-r border-slate-200"
                        style={
                          isFewDates
                            ? { minWidth: DATE_COLUMN_MIN_WIDTH_PX }
                            : {
                                width: DATE_COLUMN_MIN_WIDTH_PX,
                                minWidth: DATE_COLUMN_MIN_WIDTH_PX,
                                maxWidth: DATE_COLUMN_MIN_WIDTH_PX,
                              }
                        }
                        onMouseEnter={() => {
                          setHoveredRowId(student.id)
                          setHoveredColIndex(colIndex)
                        }}
                      >
                        <JournalCell
                          value={value}
                          isActive={isActive}
                          isRowHovered={hasActive ? isRowActive : isRowHovered}
                          isColHovered={hasActive ? isColActive : isColHovered}
                          onOpen={() => handleOpen(student.id, date)}
                          onClose={() => setActiveCell(null)}
                          draftValue={draftValue}
                          onDraftChange={(value) => {
                            draftValueRef.current = value
                            setDraftValue(value)
                          }}
                          onSave={() => {
                            void handleSave()
                          }}
                          readOnly={readOnly}
                          hideNull={hideNull}
                          openUpwards={openUpwards}
                        />
                      </td>
                    )
                  })}
                  <td
                    className="sticky right-0 z-10 h-12 border-l border-slate-200 bg-inherit"
                    style={{
                      width: AVERAGE_COLUMN_WIDTH_PX,
                      minWidth: AVERAGE_COLUMN_WIDTH_PX,
                      maxWidth: AVERAGE_COLUMN_WIDTH_PX,
                    }}
                  >
                    <JournalAverageCell value={averages[student.id]} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
