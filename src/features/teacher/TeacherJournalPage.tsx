import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { getTeacherJournal, saveTeacherGrade } from '../../api/teacherJournal'
import { OrientationNotice } from '../../components/shared/OrientationNotice'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { JournalTable } from './journal/JournalTable'
import { type JournalData, type JournalGrade } from '../../types/journal'
import { getGradeClass } from '../../lib/gradeColors'
import { getInitialJournalRange, getOlderBlockRange } from '../../lib/journalPeriod'

const MOBILE_BREAKPOINT = 768

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

function getAbsences(grades: JournalGrade[]) {
  return grades.filter((grade) => grade === 'Н').length
}

/** Компактный формат даты для мобильного отображения: ДД.ММ */
function formatDateCompact(isoDate: string): string {
  const [, m, d] = isoDate.split('-')
  if (!d || !m) return isoDate
  return `${d}.${m}`
}

const INITIAL_RANGE = getInitialJournalRange()

export function TeacherJournalPage() {
  const { classId } = useParams()
  const [showOrientationNotice, setShowOrientationNotice] = useState(false)
  const [journalData, setJournalData] = useState<JournalData | null>(null)
  const [loadedFromDate, setLoadedFromDate] = useState<string | null>(null)
  const [, setLoadedToDate] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [prependedColumnsCount, setPrependedColumnsCount] = useState(0)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['teacher', 'journal', classId, INITIAL_RANGE.fromDate, INITIAL_RANGE.toDate],
    queryFn: () =>
      getTeacherJournal({
        classId: classId ?? undefined,
        fromDate: INITIAL_RANGE.fromDate,
        toDate: INITIAL_RANGE.toDate,
      }),
  })

  useEffect(() => {
    if (data) {
      setJournalData(data)
      const dates = data.dates
      if (dates.length > 0) {
        setLoadedFromDate(dates[0])
        setLoadedToDate(dates[dates.length - 1])
      } else {
        setLoadedFromDate(INITIAL_RANGE.fromDate)
        setLoadedToDate(INITIAL_RANGE.toDate)
      }
      setPrependedColumnsCount(0)
    }
  }, [data])

  const prevClassIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    // Сбрасываем состояние только при реальной смене класса (не при первом монтировании).
    // Иначе при переходе Назад → снова Журнал тот же classId считался «сменой» и обнулял journalData.
    const isInitialMount = prevClassIdRef.current === undefined
    const isClassChange = prevClassIdRef.current !== undefined && prevClassIdRef.current !== classId
    prevClassIdRef.current = classId
    if (!isInitialMount && isClassChange) {
      setJournalData(null)
      setLoadedFromDate(null)
      setLoadedToDate(null)
      setPrependedColumnsCount(0)
    }
  }, [classId])

  const handleReachLeftEdge = useCallback(async () => {
    if (!journalData || !loadedFromDate || isLoadingMore) return
    const range = getOlderBlockRange(loadedFromDate)
    if (range.fromDate >= loadedFromDate) return
    setIsLoadingMore(true)
    try {
      const chunk = await getTeacherJournal({
        classId: journalData.classId,
        subjectId: journalData.subjectId || undefined,
        fromDate: range.fromDate,
        toDate: range.toDate,
      })
      if (chunk.dates.length === 0) {
        setIsLoadingMore(false)
        return
      }
      const mergedDates = [...chunk.dates, ...journalData.dates]
      const mergedGrades: Record<string, Record<string, JournalGrade>> = {}
      for (const s of journalData.students) {
        const existing = journalData.grades[s.id] ?? {}
        const fromChunk = chunk.grades[s.id] ?? {}
        mergedGrades[s.id] = { ...fromChunk, ...existing }
      }
      setJournalData({
        ...journalData,
        dates: mergedDates,
        grades: mergedGrades,
      })
      setLoadedFromDate(mergedDates[0])
      setPrependedColumnsCount(chunk.dates.length)
    } finally {
      setIsLoadingMore(false)
    }
  }, [journalData, loadedFromDate, isLoadingMore])

  const handleScrollPositionRestored = useCallback(() => {
    setPrependedColumnsCount(0)
  }, [])

  useEffect(() => {
    const updateOrientationState = () => {
      const dismissed = sessionStorage.getItem('journal-orientation-dismissed') === '1'
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      const portrait = window.matchMedia('(orientation: portrait)').matches
      setShowOrientationNotice(mobile && portrait && !dismissed)
    }
    updateOrientationState()
    const mediaQuery = window.matchMedia('(orientation: portrait)')
    window.addEventListener('resize', updateOrientationState)
    mediaQuery.addEventListener('change', updateOrientationState)
    return () => {
      window.removeEventListener('resize', updateOrientationState)
      mediaQuery.removeEventListener('change', updateOrientationState)
    }
  }, [])

  const handleDismissNotice = () => {
    sessionStorage.setItem('journal-orientation-dismissed', '1')
    setShowOrientationNotice(false)
  }

  const titleText = journalData?.className
    ? journalData.subjectId
      ? `Журнал: ${journalData.className} ${journalData.subject}`
      : `Журнал ${journalData.className} класса`
    : 'Журнал класса'

  const pageTitleBlock = (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center justify-center gap-3 px-4 py-3">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{titleText}</h1>
    </div>
  )

  const cardGrades = useMemo(() => {
    if (!journalData) return []
    return journalData.students.map((student) => ({
      id: student.id,
      name: student.name,
      grades: journalData.dates.map((date) => journalData.grades[student.id]?.[date] ?? null),
    }))
  }, [journalData])

  const hasNoLessons = Boolean(
    journalData &&
      (journalData.students.length === 0 || journalData.dates.length === 0),
  )
  const isEmpty =
    !isLoading && !isError && (!journalData || hasNoLessons)

  return (
    <div className={`relative ${showOrientationNotice ? 'pt-16' : ''}`}>
      <OrientationNotice visible={showOrientationNotice} onDismiss={handleDismissNotice} />
      <div className="sticky top-[73px] z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/90 dark:border-zinc-600 dark:bg-zinc-800/92">
        {pageTitleBlock}
      </div>
      <div className="px-4 py-4">
        <StateWrapper
          isLoading={isLoading}
          isError={isError}
          isEmpty={isEmpty}
          onRetry={refetch}
          emptyTitle={hasNoLessons ? 'Нет уроков' : 'Нет данных'}
          emptyDescription={
            hasNoLessons
              ? 'В выбранном периоде нет занятий по этому предмету.'
              : 'Журнал пока пуст.'
          }
        >
          {journalData && !hasNoLessons ? (
            <>
              <div className="block md:hidden">
                <div className="flex flex-col gap-3">
                  {cardGrades.map((student) => (
                    <div key={student.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-base font-semibold text-slate-900">{student.name}</div>
                        <div className="text-right text-xs font-semibold text-slate-600">
                          <div>Средняя: {getAverage(student.grades)}</div>
                          <div>Пропуски: {getAbsences(student.grades)}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(() => {
                          const withDates = journalData.dates
                            .map((date, i) => ({ date, grade: student.grades[i] }))
                            .filter((item): item is { date: string; grade: NonNullable<JournalGrade> } => item.grade !== null)
                          if (withDates.length === 0) {
                            return <span className="text-sm text-slate-500">Нет оценок</span>
                          }
                          return withDates.map(({ date, grade }) => (
                            <span
                              key={`${student.id}-${date}`}
                              className={`inline-flex flex-col items-center rounded-lg border border-slate-200 px-2 py-1 ${getGradeClass(
                                grade,
                              )}`}
                              title={date}
                            >
                              <span className="text-[10px] leading-tight text-slate-500">
                                {formatDateCompact(date)}
                              </span>
                              <span className="text-sm font-semibold">{grade}</span>
                            </span>
                          ))
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden md:block">
                <JournalTable
                  data={journalData}
                  onSaveGrade={async (studentId, date, value) => {
                    try {
                      await saveTeacherGrade({
                        classId: journalData.classId,
                        subjectId: journalData.subjectId,
                        studentId,
                        dateISO: date,
                        value,
                      })
                      toast.success('Сохранено')
                    } catch (error) {
                      toast.error('Не удалось сохранить')
                    }
                  }}
                  onReachLeftEdge={handleReachLeftEdge}
                  prependedColumnsCount={prependedColumnsCount}
                  onScrollPositionRestored={handleScrollPositionRestored}
                  isLoadingMore={isLoadingMore}
                />
              </div>
            </>
          ) : null}
        </StateWrapper>
      </div>
    </div>
  )
}
