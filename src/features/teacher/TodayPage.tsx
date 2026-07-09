import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getTeacherLessons } from '../../api/teacher'
import { PageHeader } from '../../components/layout/PageHeader'
import { LessonCard } from '../../components/shared/LessonCard'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { WeekNavigator } from '../me/components/WeekNavigator'
import { formatSelectedScheduleDay } from './scheduleDayFormat'

const TEACHER_SCHEDULE_STORAGE_KEY = 'teacher-schedule'

type StoredSchedule = { dayIndex: number; weekOffset: number }

function loadStoredSchedule(): StoredSchedule | null {
  try {
    const raw = localStorage.getItem(TEACHER_SCHEDULE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'dayIndex' in parsed &&
      'weekOffset' in parsed &&
      Number.isInteger((parsed as StoredSchedule).dayIndex) &&
      Number.isInteger((parsed as StoredSchedule).weekOffset)
    ) {
      const { dayIndex, weekOffset } = parsed as StoredSchedule
      if (dayIndex >= 0 && dayIndex <= 4 && weekOffset >= -1 && weekOffset <= 1) {
        return { dayIndex, weekOffset }
      }
    }
  } catch {
    // ignore
  }
  return null
}

function saveStoredSchedule(dayIndex: number, weekOffset: number) {
  try {
    localStorage.setItem(
      TEACHER_SCHEDULE_STORAGE_KEY,
      JSON.stringify({ dayIndex, weekOffset })
    )
  } catch {
    // ignore
  }
}

const WEEKDAY_OPTIONS = [
  { label: 'Пн', index: 0 },
  { label: 'Вт', index: 1 },
  { label: 'Ср', index: 2 },
  { label: 'Чт', index: 3 },
  { label: 'Пт', index: 4 },
] as const

function getDefaultDayIndex(): 0 | 1 | 2 | 3 | 4 {
  const today = new Date().getDay()
  if (today === 0 || today === 6) return 0
  const mapped = today - 1
  if (mapped < 0) return 0
  if (mapped > 4) return 4
  return mapped as 0 | 1 | 2 | 3 | 4
}

function getWeekStart(date: Date) {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(date)
  start.setDate(date.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function formatWeekRange(start: Date) {
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  })
  return `${formatter.format(start)}–${formatter.format(end)}`
}

export function TodayPage() {
  const defaultDay = getDefaultDayIndex()
  const stored = useMemo(() => loadStoredSchedule(), [])
  const [weekOffset, setWeekOffset] = useState<-1 | 0 | 1>(
    stored ? (stored.weekOffset as -1 | 0 | 1) : 0
  )
  const [dayIndex, setDayIndex] = useState<0 | 1 | 2 | 3 | 4>(
    stored ? (stored.dayIndex as 0 | 1 | 2 | 3 | 4) : defaultDay
  )
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    saveStoredSchedule(dayIndex, weekOffset)
  }, [dayIndex, weekOffset])

  const goToCurrentWeekAndDay = useCallback(() => {
    const day = getDefaultDayIndex()
    setWeekOffset(0)
    setDayIndex(day)
  }, [])

  const isCurrentWeek = weekOffset === 0
  const isCurrentDay = dayIndex === defaultDay
  const showResetDate = !isCurrentWeek || !isCurrentDay

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['teacher', 'lessons', weekOffset, dayIndex],
    queryFn: () => getTeacherLessons({ weekOffset, dayIndex }),
  })

  const handleWeekChange = (delta: -1 | 1) => {
    setWeekOffset((prev) => {
      const next = prev + delta
      if (next < -1) return -1
      if (next > 1) return 1
      return next as -1 | 0 | 1
    })
  }

  const weekStart = useMemo(() => {
    const base = getWeekStart(new Date())
    base.setDate(base.getDate() + weekOffset * 7)
    return base
  }, [weekOffset])

  const scheduleDayTitle = useMemo(
    () => formatSelectedScheduleDay(weekStart, dayIndex, now),
    [weekStart, dayIndex, now],
  )

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <PageHeader
        title={scheduleDayTitle}
        subtitle="Выберите урок, чтобы открыть журнал"
      />

      <WeekNavigator
        label={formatWeekRange(weekStart)}
        onPrev={() => handleWeekChange(-1)}
        onNext={() => handleWeekChange(1)}
        onCurrentWeek={showResetDate ? goToCurrentWeekAndDay : undefined}
      />

      <div className="grid grid-cols-5 gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-900">
        {WEEKDAY_OPTIONS.map((option) => {
          const isActive = option.index === dayIndex
          const dayDate = new Date(weekStart)
          dayDate.setDate(weekStart.getDate() + option.index)
          const dayNumber = dayDate.getDate()
          return (
            <button
              key={option.index}
              type="button"
              onClick={() => setDayIndex(option.index)}
              className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-sm font-semibold ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <span>{option.label}</span>
              <span
                className={`text-xs font-normal ${
                  isActive ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {dayNumber}
              </span>
            </button>
          )
        })}
      </div>

      <StateWrapper
        isLoading={isLoading}
        isError={isError}
        isEmpty={!isLoading && !isError && (!data || data.length === 0)}
        onRetry={refetch}
        emptyTitle="Уроков нет"
        emptyDescription="В этот день занятий не запланировано."
      >
        <div className="flex flex-col gap-3">
          {data?.map((lesson, index) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              dayIndex={dayIndex}
              weekOffset={weekOffset}
              lessonNumber={index + 1}
            />
          ))}
        </div>
      </StateWrapper>
    </div>
  )
}
