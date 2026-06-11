import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getMySchedule } from '../../api/me'
import { PageHeader } from '../../components/layout/PageHeader'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { ChildSelector } from './ChildSelector'
import { useAuth } from '../auth/useAuth'
import { useChildSelection } from './useChildSelection'
import { DaySection } from '../me/components/DaySection'
import { WeekNavigator } from '../me/components/WeekNavigator'
import { isForbidden, isNotFound } from '../../lib/errors'
import { formatLocalDateYmd } from '../../lib/localDate'
import type { ScheduleItem } from '../../types/schedule'

const WEEK_DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'] as const

function getWeekStart(date: Date) {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(date)
  start.setDate(date.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function formatCurrentDateTime() {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  return formatter.format(new Date())
}

function formatDayTitle(date: Date) {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
  })
  return formatter.format(date)
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

/**
 * Текущий учебный год: если месяц >= 9, то текущий год, иначе предыдущий.
 * Локальный календарь браузера. Правило совпадает по смыслу с сервером (админка uses APP_TIMEZONE),
 * но канон для серверной логики не дублируем — эти границы только ограничивают UX-навигацию недель.
 */
function getCurrentSchoolYear(): number {
  const now = new Date()
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

/** Границы учебного года для клипа prev/next: 1 сентября — 31 мая (понедельники недель краёв). Не участвует в API. */
function getSchoolYearWeekBounds(): { firstMonday: Date; lastMonday: Date } {
  const year = getCurrentSchoolYear()
  const start = new Date(year, 8, 1) // 1 сентября
  const end = new Date(year + 1, 4, 31) // 31 мая следующего года
  return {
    firstMonday: getWeekStart(start),
    lastMonday: getWeekStart(end),
  }
}

export function SchedulePage() {
  const [weekStartYmd, setWeekStartYmd] = useState<string>(() =>
    formatLocalDateYmd(getWeekStart(new Date()))
  )
  const { user } = useAuth()
  const { childId, setChildId, children, isChildrenLoading } = useChildSelection()
  const activeChildId = user?.role === 'parent' ? childId : (user?.id ?? '')
  const parentBlocked =
    user?.role === 'parent' && !isChildrenLoading && children.length === 0

  const weekStart = useMemo(() => new Date(weekStartYmd + 'T00:00:00'), [weekStartYmd])

  const { data = [], isLoading, isError, refetch, error } = useQuery<ScheduleItem[]>({
    queryKey: ['me', 'schedule', 'week', activeChildId, weekStartYmd],
    queryFn: () => getMySchedule('week', activeChildId, weekStartYmd),
    enabled: !!activeChildId,
  })

  const isGone = Boolean(isError && error && isNotFound(error))

  useEffect(() => {
    if (!isError || !error || !isForbidden(error)) return
    const firstId = children[0]?.id
    if (firstId && childId !== firstId) {
      setChildId(firstId)
      toast.error('Нет доступа к этому ребёнку. Выбран первый доступный.')
    }
  }, [isError, error, children, childId, setChildId])

  const weekDays = useMemo(() => {
    return WEEK_DAYS.map((label, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      return { label, date }
    })
  }, [weekStart])

  const groupedWeek = useMemo(() => {
    return WEEK_DAYS.map((dayLabel) => {
      const items = data
        .filter((item) => item.dayLabel === dayLabel)
        .sort((a, b) => a.lessonNumber - b.lessonNumber)
      return { dayLabel, items }
    })
  }, [data])

  const [currentDateTime, setCurrentDateTime] = useState(() => formatCurrentDateTime())
  useEffect(() => {
    const tick = () => setCurrentDateTime(formatCurrentDateTime())
    tick()
    const id = window.setInterval(tick, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  const { firstMonday, lastMonday } = useMemo(() => getSchoolYearWeekBounds(), [])
  const thisWeekStart = getWeekStart(new Date())
  const isCurrentWeek = weekStart.getTime() === thisWeekStart.getTime()

  const canGoPrev = weekStart.getTime() > firstMonday.getTime()
  const canGoNext = weekStart.getTime() < lastMonday.getTime()

  const goPrevWeek = () => {
    if (!canGoPrev) return
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStartYmd(formatLocalDateYmd(d))
  }
  const goNextWeek = () => {
    if (!canGoNext) return
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStartYmd(formatLocalDateYmd(d))
  }
  const goToCurrentWeek = () => {
    setWeekStartYmd(formatLocalDateYmd(getWeekStart(new Date())))
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <PageHeader title="Расписание" />
        <div className="-mt-2 text-sm font-semibold text-slate-700 underline decoration-slate-300">
          {currentDateTime}
        </div>
      </div>

      <ChildSelector />

      <WeekNavigator
        label={formatWeekRange(weekStart)}
        onPrev={goPrevWeek}
        onNext={goNextWeek}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onCurrentWeek={isCurrentWeek ? undefined : goToCurrentWeek}
      />

      <StateWrapper
        isLoading={
          !parentBlocked &&
          !isGone &&
          (isLoading || (user?.role === 'parent' && !activeChildId && isChildrenLoading))
        }
        isError={!parentBlocked && !isGone && isError}
        isEmpty={
          parentBlocked ||
          isGone ||
          (!parentBlocked && !isGone && !isLoading && !isError && data.length === 0)
        }
        onRetry={refetch}
        emptyTitle={
          parentBlocked ? 'Нет привязанных детей' : isGone ? 'Данные недоступны' : 'Нет уроков'
        }
        emptyDescription={
          parentBlocked
            ? 'Чтобы видеть расписание, администратор должен привязать ребёнка к вашему аккаунту.'
            : isGone
              ? 'Класс могли архивировать или изменили доступ. Обратитесь к администратору школы.'
              : 'Расписание пока пустое.'
        }
      >
        <div className="flex flex-col gap-4">
          {weekDays.map((day) => {
            const grouped = groupedWeek.find((item) => item.dayLabel === day.label)
            const items = grouped?.items ?? []
            return (
              <DaySection
                key={day.label}
                title={formatDayTitle(day.date)}
                items={items}
              />
            )
          })}
        </div>
      </StateWrapper>
    </div>
  )
}
