import { useCallback, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { getMyProgress } from '../../api/me'
import { PageHeader } from '../../components/layout/PageHeader'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { useAuth } from '../auth/useAuth'
import { useChildSelection } from '../student/useChildSelection'
import type { SubjectProgress } from '../../types/progress'
import { ROLE_HOME } from '../../lib/roleHome'
import { getAverageFromGrades } from '../../lib/progressAverage'
import { useHeaderBack } from '../../contexts/useHeaderBack'

function getInitials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  const [lastName, firstName] = parts
  return `${(lastName[0] ?? '').toUpperCase()}${(firstName[0] ?? '').toUpperCase()}`
}

function getProfileValue(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) return 'Не указано'
  return value
}

function getCurrentYearStart(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 9 ? year : year - 1
}

function getCurrentSemester(): 1 | 2 {
  const now = new Date()
  const month = now.getMonth() + 1
  // 1 семестр: сентябрь–январь, 2 семестр: февраль–май
  if (month >= 9 || month === 1) return 1
  return 2
}

export function MyProfilePage() {
  const { user } = useAuth()
  const { childId, children, isChildrenLoading } = useChildSelection()
  const navigate = useNavigate()
  const headerBack = useHeaderBack()

  const isStudentOrParent = user?.role === 'student' || user?.role === 'parent'
  const progressChildId = user?.role === 'parent' ? childId : undefined

  const yearStart = useMemo(() => getCurrentYearStart(), [])
  const semester = useMemo(() => getCurrentSemester(), [])

  const progressEnabled =
    isStudentOrParent &&
    (user?.role === 'student' ||
      (user?.role === 'parent' && Boolean(childId) && children.length > 0))

  const { data = [], isLoading, isError, refetch } = useQuery<SubjectProgress[]>({
    queryKey: ['me', 'profile', 'average', progressChildId, yearStart, semester],
    queryFn: () => getMyProgress(progressChildId, yearStart, semester),
    enabled: progressEnabled,
  })

  const overallAverage = useMemo(() => {
    if (!isStudentOrParent || !data.length) return null
    const allGrades = data.flatMap((item) => item.grades)
    return getAverageFromGrades(allGrades)
  }, [data, isStudentOrParent])

  const initials = getInitials(user?.name)
  const fullName = user?.name ?? 'Не указано'

  const averageDisplay = !isStudentOrParent
    ? '—'
    : user?.role === 'parent' && isChildrenLoading
      ? '…'
    : user?.role === 'parent' && children.length === 0
      ? 'Нет привязанных детей'
      : user?.role === 'parent' && !childId
        ? 'Выберите ребёнка в разделе «Расписание»'
        : overallAverage !== null
          ? overallAverage.toString()
          : 'Нет данных'

  const handleBack = useCallback(() => {
    if (window.history.length > 2) {
      navigate(-1)
      return
    }
    const role = user?.role
    if (role) {
      navigate(ROLE_HOME[role], { replace: true })
      return
    }
    navigate('/', { replace: true })
  }, [navigate, user])

  useEffect(() => {
    if (!headerBack) return
    headerBack.setBack(handleBack)
    return () => {
      headerBack.clearBack()
    }
  }, [headerBack, handleBack])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <PageHeader title="Мой профиль" />

      <section className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-2xl font-semibold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold text-slate-900">{fullName}</div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Средний балл</div>
        <StateWrapper
          isLoading={isLoading && progressEnabled}
          isError={isError}
          isEmpty={false}
          onRetry={refetch}
        >
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-4">
            <div className="text-4xl font-semibold text-slate-900">{averageDisplay}</div>
          </div>
        </StateWrapper>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Профиль</div>
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-4">
          <ProfileRow label="Класс" value={getProfileValue(user?.className)} />
          <ProfileRow label="Email" value={getProfileValue(user?.email)} />
          <ProfileRow label="Телефон" value={null} />
          <ProfileRow label="Дата рождения" value={null} />
          <ProfileRow
            label="Родители"
            value={
              user?.parentNames?.length
                ? user.parentNames.join(', ')
                : null
            }
          />
          <ProfileRow label="Дата последнего входа" value={null} />
        </div>
      </section>
    </div>
  )
}

type ProfileRowProps = {
  label: string
  value: string | null
}

function ProfileRow({ label, value }: ProfileRowProps) {
  const display = value && value.trim().length > 0 ? value : 'Не указано'
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="text-sm font-semibold text-slate-600">{label}</div>
      <div className="flex-1 text-right text-base font-medium text-slate-900">{display}</div>
    </div>
  )
}

