import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getMyProgress } from '../../api/me'
import { PageHeader } from '../../components/layout/PageHeader'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { type ProgressGrade } from '../../types/progress'
import type { SubjectProgress } from '../../types/progress'
import { getAverageFromGrades } from '../../lib/progressAverage'
import { ChildSelector } from './ChildSelector'
import { useAuth } from '../auth/useAuth'
import { useChildSelection } from './useChildSelection'
import { isForbidden, isNotFound } from '../../lib/errors'

function getGradeClassName(grade: ProgressGrade) {
  if (grade === 5) return 'text-[#35751e]'
  if (grade === 4) return 'text-[#91af2e]'
  if (grade === 3) return 'text-[#d1791d]'
  if (grade === 2) return 'text-[#d02c2c]'
  if (grade === 1) return 'text-[#6b7280]'
  if (grade === 0) return 'text-[#6b7280]'
  return 'text-[#6b7280]'
}

/** Компактный формат даты: ДД.ММ */
function formatDateCompact(isoDate: string): string {
  const [, m, d] = isoDate.split('-')
  if (!d || !m) return isoDate
  return `${d}.${m}`
}

/** Первый год учебного года: если месяц >= 9, то текущий год, иначе предыдущий. */
function getCurrentYearStart(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 9 ? year : year - 1
}

/** 1 семестр: сентябрь–январь, 2 семестр: февраль–май */
function getCurrentSemester(): 1 | 2 {
  const month = new Date().getMonth() + 1
  if (month >= 9 || month === 1) return 1
  return 2
}

export function ProgressPage() {
  const { user } = useAuth()
  const { childId, setChildId, children, isChildrenLoading } = useChildSelection()
  const activeChildId = user?.role === 'parent' ? childId : (user?.id ?? '')
  const parentBlocked =
    user?.role === 'parent' && !isChildrenLoading && children.length === 0
  const yearStart = useMemo(() => getCurrentYearStart(), [])
  const semester = useMemo(() => getCurrentSemester(), [])

  const { data = [], isLoading, isError, refetch, error } = useQuery<SubjectProgress[]>({
    queryKey: ['me', 'progress', activeChildId, yearStart, semester],
    queryFn: () => getMyProgress(activeChildId, yearStart, semester),
    enabled: !!activeChildId && typeof yearStart === 'number' && (semester === 1 || semester === 2),
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <PageHeader title="Прогресс" subtitle="Оценки и пропуски" />

      <ChildSelector />

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
          parentBlocked ? 'Нет привязанных детей' : isGone ? 'Данные недоступны' : 'Нет данных'
        }
        emptyDescription={
          parentBlocked
            ? 'Чтобы видеть оценки, администратор должен привязать ребёнка к вашему аккаунту.'
            : isGone
              ? 'Класс могли архивировать или изменили доступ. Обратитесь к администратору школы.'
              : 'Оценок пока нет.'
        }
      >
        <div className="flex flex-col gap-3">
          {data.map((item) => {
            const average = getAverageFromGrades(item.grades)
            return (
              <div
                key={`${item.subject}-${yearStart}-${semester}`}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="text-lg font-semibold text-slate-900">
                  {item.subject}
                </div>
                <div className="text-sm text-slate-600">{item.teacherName}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.grades.map((grade, index) => {
                    const date = item.gradeDates[index]
                    return (
                      <span
                        key={`${item.subject}-${date ?? index}`}
                        className={`inline-flex flex-col items-center rounded-lg border border-slate-200 px-2 py-1 ${getGradeClassName(
                          grade,
                        )}`}
                        title={date}
                      >
                        {date ? (
                          <span className="text-[10px] leading-tight text-slate-500">
                            {formatDateCompact(date)}
                          </span>
                        ) : null}
                        <span className="text-sm font-semibold">{grade}</span>
                      </span>
                    )
                  })}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Средний балл: {average ?? '—'}
                </div>
                <div className="text-sm text-slate-600">
                  Пропуски: {item.absencesCount}
                </div>
              </div>
            )
          })}
        </div>
      </StateWrapper>
    </div>
  )
}
