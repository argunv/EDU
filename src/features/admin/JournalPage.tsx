import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { getAdminClasses, getAdminClassSubjects, getAdminJournal } from '../../api/admin'
import { OrientationNotice } from '../../components/shared/OrientationNotice'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { JournalTable } from '../teacher/journal/JournalTable'
import { type JournalData, type JournalGrade } from '../../types/journal'
import { getGradeClass } from '../../lib/gradeColors'
import { getInitialJournalRange, getOlderBlockRange } from '../../lib/journalPeriod'

const MOBILE_BREAKPOINT = 768
const INITIAL_RANGE = getInitialJournalRange()

function normalizeJournalGrade(value: unknown): JournalGrade {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) return null
    if (normalized === 'Н') return 'Н'
    if (normalized === '2' || normalized === '3' || normalized === '4' || normalized === '5') {
      return Number(normalized) as 2 | 3 | 4 | 5
    }
    return null
  }
  if (value === 2 || value === 3 || value === 4 || value === 5) return value
  return null
}

function mapAdminToJournalTable(
  classId: string | undefined,
  data: Awaited<ReturnType<typeof getAdminJournal>>,
  subjectName?: string,
  classNameDisplay?: string,
): JournalData {
  // Даты приходят с бэкенда: только дни недели (Пн–Пт) по расписанию, включая сегодня если урок сегодня
  const dates = data.dates?.length ? data.dates : [new Date().toISOString().split('T')[0]]
  const grades = data.students.reduce<Record<string, Record<string, JournalGrade>>>(
    (acc, student) => {
      acc[student.id] = {}
      dates.forEach((date, index) => {
        acc[student.id][date] = normalizeJournalGrade(student.grades[index])
      })
      return acc
    },
    {},
  )

  return {
    classId: classId ?? 'class',
    className: classNameDisplay ?? (classId ? classId.toUpperCase() : 'Класс'),
    subject: subjectName ?? data.lessonMeta.title,
    subjectId: '',
    subjects: [],
    dates,
    students: data.students.map((student) => ({ id: student.id, name: student.name })),
    grades,
  }
}

function formatClassLabel(classId?: string) {
  if (!classId) return null
  const match = classId.match(/class-(\d{1,2})([a-zа-я])/i)
  if (!match) return classId.toUpperCase()
  const number = match[1]
  const letter = match[2].toUpperCase()
  const mapped =
    letter === 'A' ? 'А' : letter === 'B' ? 'Б' : letter === 'V' ? 'В' : letter
  return `${number}${mapped}`
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

function getAbsences(grades: JournalGrade[]) {
  return grades.filter((grade) => grade === 'Н').length
}

/** Компактный формат даты для мобильного отображения: ДД.ММ */
function formatDateCompact(isoDate: string): string {
  const [, m, d] = isoDate.split('-')
  if (!d || !m) return isoDate
  return `${d}.${m}`
}

export function JournalPage() {
  const navigate = useNavigate()
  const { classId, subjectId } = useParams()
  const [search, setSearch] = useState('')
  const [showOrientationNotice, setShowOrientationNotice] = useState(false)
  const [journalData, setJournalData] = useState<JournalData | null>(null)
  const [loadedFromDate, setLoadedFromDate] = useState<string | null>(null)
  const [, setLoadedToDate] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [prependedColumnsCount, setPrependedColumnsCount] = useState(0)

  const classesQuery = useQuery({
    queryKey: ['admin', 'classes'],
    queryFn: () => getAdminClasses(),
    enabled: Boolean(classId),
  })

  const subjectsQuery = useQuery({
    queryKey: ['admin', 'subjects', classId],
    queryFn: () => getAdminClassSubjects(classId ?? ''),
    enabled: Boolean(classId),
  })

  const selectedClass = classesQuery.data?.find((c) => c.id === classId)
  const classNameForTitle = selectedClass?.name ?? (classId ? undefined : null)

  const {
    data,
    isLoading: isJournalLoading,
    isError: isJournalError,
    refetch: refetchJournal,
  } = useQuery({
    queryKey: ['admin', 'journal', classId, subjectId, INITIAL_RANGE.fromDate, INITIAL_RANGE.toDate],
    queryFn: () =>
      getAdminJournal(classId ?? '', subjectId, {
        fromDate: INITIAL_RANGE.fromDate,
        toDate: INITIAL_RANGE.toDate,
      }),
    enabled: Boolean(classId) && subjectId !== undefined,
  })

  useEffect(() => {
    if (data && subjectId) {
      const subjectName =
        subjectsQuery.data?.find((item) => item.id === subjectId)?.name ?? data.lessonMeta.title
      const mapped = mapAdminToJournalTable(classId, data, subjectName, selectedClass?.name)
      setJournalData(mapped)
      if (mapped.dates.length > 0) {
        setLoadedFromDate(mapped.dates[0])
        setLoadedToDate(mapped.dates[mapped.dates.length - 1])
      } else {
        setLoadedFromDate(INITIAL_RANGE.fromDate)
        setLoadedToDate(INITIAL_RANGE.toDate)
      }
      setPrependedColumnsCount(0)
    }
  }, [data, subjectId, classId, subjectsQuery.data, selectedClass?.name])

  const prevContextRef = useRef({ classId, subjectId })
  useEffect(() => {
    const prev = prevContextRef.current
    if (prev.classId !== classId || prev.subjectId !== subjectId) {
      prevContextRef.current = { classId: classId ?? '', subjectId: subjectId ?? '' }
      setJournalData(null)
      setLoadedFromDate(null)
      setLoadedToDate(null)
      setPrependedColumnsCount(0)
    }
  }, [classId, subjectId])

  const handleReachLeftEdge = useCallback(async () => {
    if (!journalData || !loadedFromDate || isLoadingMore || !classId || !subjectId) return
    const range = getOlderBlockRange(loadedFromDate)
    if (range.fromDate >= loadedFromDate) return
    setIsLoadingMore(true)
    try {
      const chunkRaw = await getAdminJournal(classId, subjectId, {
        fromDate: range.fromDate,
        toDate: range.toDate,
      })
      const subjectName =
        subjectsQuery.data?.find((item) => item.id === subjectId)?.name ?? chunkRaw.lessonMeta.title
      const chunk = mapAdminToJournalTable(classId, chunkRaw, subjectName, selectedClass?.name)
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
  }, [
    journalData,
    loadedFromDate,
    isLoadingMore,
    classId,
    subjectId,
    subjectsQuery.data,
    selectedClass?.name,
  ])

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

  const filteredStudents = useMemo(() => {
    if (!journalData || !subjectId) return []
    const query = search.trim().toLowerCase()
    if (!query) return journalData.students
    return journalData.students.filter((student) => student.name.toLowerCase().includes(query))
  }, [journalData, search, subjectId])

  const classLabel = classNameForTitle ?? formatClassLabel(classId)
  const titleText = classLabel ? `Журнал ${classLabel} класса` : 'Журнал класса'
  const selectedSubject = subjectsQuery.data?.find((item) => item.id === subjectId) ?? null

  const pageTitleBlock = (
    <div className="mx-auto w-full max-w-2xl">
      <header className="flex min-h-[56px] flex-wrap items-center justify-center gap-3 border-b border-slate-200 bg-white px-4 py-4 dark:border-zinc-600 dark:bg-zinc-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {titleText}
        </h1>
      </header>
      {selectedSubject ? (
        <div className="border-b border-slate-200 bg-white px-4 pb-3 pt-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <div className="leading-6">
            <span className="font-semibold">Предмет:</span> {selectedSubject.name}
          </div>
          <div className="leading-6">
            <span className="font-semibold">Преподаватели:</span>{' '}
            {selectedSubject.teachers?.length && selectedSubject.teachers.length > 0
              ? selectedSubject.teachers.join('; ')
              : 'не указан'}
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className={`relative ${showOrientationNotice ? 'pt-16' : ''}`}>
      <OrientationNotice visible={showOrientationNotice} onDismiss={handleDismissNotice} />
      <div className="px-4 pt-4">
        {pageTitleBlock}
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 py-3">
      <StateWrapper
        isLoading={subjectId ? isJournalLoading : subjectsQuery.isLoading}
        isError={subjectId ? isJournalError : subjectsQuery.isError}
        isEmpty={
          subjectId
            ? !isJournalLoading && !isJournalError && !journalData
            : !subjectsQuery.isLoading &&
              !subjectsQuery.isError &&
              (!subjectsQuery.data || subjectsQuery.data.length === 0)
        }
        onRetry={() => {
          if (subjectId) {
            refetchJournal()
          } else {
            subjectsQuery.refetch()
          }
        }}
        emptyTitle={subjectId ? 'Нет данных' : 'Нет предметов'}
        emptyDescription={subjectId ? 'Журнал пока пуст.' : 'Для класса пока нет предметов.'}
      >
        {subjectId ? (
          journalData ? (
            journalData.students.length > 0 ? (
            <>
              <div className="block md:hidden">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск по ФИО"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                />
                <div className="mt-4 flex flex-col gap-3">
                  {filteredStudents.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                      Ничего не найдено.
                    </div>
                  ) : (
                    filteredStudents.map((student) => {
                      const grades = journalData.dates.map(
                        (date) => journalData.grades[student.id]?.[date] ?? null
                      )
                      return (
                        <div key={student.id} className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-base font-semibold text-slate-900">{student.name}</div>
                            <div className="text-right text-xs font-semibold text-slate-600">
                              <div>Средняя: {getAverage(grades)}</div>
                              <div>Пропуски: {getAbsences(grades)}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(() => {
                              const withDates = journalData.dates
                                .map((date, i) => ({ date, grade: grades[i] }))
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
                      )
                    })
                  )}
                </div>
              </div>

              <div className="hidden md:block">
                <JournalTable
                  data={journalData}
                  readOnly
                  cornerLabel=""
                  onReachLeftEdge={handleReachLeftEdge}
                  prependedColumnsCount={prependedColumnsCount}
                  onScrollPositionRestored={handleScrollPositionRestored}
                  isLoadingMore={isLoadingMore}
                />
              </div>
            </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-base text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                В этом классе пока нет учеников
              </div>
            )
          ) : null
        ) : (
          <>
            <div className="mx-auto w-full max-w-2xl">
              <div className="text-center text-base font-semibold text-slate-900">
                Класс: {classLabel ?? '—'}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(subjectsQuery.data ?? []).map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => navigate(`/admin/journal/${classId}/${subject.id}`)}
                    className="flex min-h-16 flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-left"
                  >
                    <span className="text-lg font-semibold text-slate-900">{subject.name}</span>
                    <span className="text-sm text-slate-600">
                      {subject.teachers?.length ? subject.teachers.join('; ') : 'Преподаватель не указан'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </StateWrapper>
      </div>
    </div>
  )
}
