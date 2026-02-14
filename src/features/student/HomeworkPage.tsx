import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getMyHomework } from '../../api/me'
import { PageHeader } from '../../components/layout/PageHeader'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { ChildSelector } from './ChildSelector'
import { useAuth } from '../auth/useAuth'
import { useChildSelection } from './useChildSelection'
import { isForbidden } from '../../lib/errors'
import type { HomeworkItem } from '../../types/homework'

export function HomeworkPage() {
  const [range, setRange] = useState<'today' | 'tomorrow' | 'week'>('today')
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const { user } = useAuth()
  const { childId, setChildId, children, isChildrenLoading } = useChildSelection()
  const activeChildId = user?.role === 'parent' ? childId : (user?.id ?? '')

  const { data = [], isLoading, isError, refetch, error } = useQuery<HomeworkItem[]>({
    queryKey: ['me', 'homework', range, activeChildId],
    queryFn: () => getMyHomework(range, activeChildId),
    enabled: !!activeChildId,
  })

  useEffect(() => {
    if (!isError || !error || !isForbidden(error)) return
    const firstId = children[0]?.id
    if (firstId && childId !== firstId) {
      setChildId(firstId)
      toast.error('Нет доступа к этому ребёнку. Выбран первый доступный.')
    }
  }, [isError, error, children, childId, setChildId])

  const items = useMemo(() => data, [data])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <PageHeader title="Домашние задания" subtitle="Выберите период" />

      <ChildSelector />

      <div className="flex rounded-xl border border-border bg-card p-1">
        {(['today', 'tomorrow', 'week'] as const).map((value) => {
          const isActive = range === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`h-11 flex-1 rounded-lg text-sm font-semibold ${
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {value === 'today' ? 'Сегодня' : value === 'tomorrow' ? 'Завтра' : 'Неделя'}
            </button>
          )
        })}
      </div>

      <StateWrapper
        isLoading={isLoading || (user?.role === 'parent' && !activeChildId && isChildrenLoading)}
        isError={isError}
        isEmpty={!isLoading && !isError && data.length === 0}
        onRetry={refetch}
        emptyTitle="Нет заданий"
        emptyDescription="Домашних заданий на этот период нет."
      >
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const isLong = item.text.length > 90
            const isExpanded = Boolean(expandedIds[item.id])
            const previewText = isLong ? `${item.text.slice(0, 110)}…` : item.text
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="text-sm text-muted-foreground">{item.dueDateLabel}</div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {item.subject}
                </div>
                <div className="mt-2 text-base leading-relaxed text-foreground">
                  {isExpanded ? item.text : previewText}
                </div>
                {isLong && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIds((prev) => ({
                        ...prev,
                        [item.id]: !isExpanded,
                      }))
                    }
                    className="mt-2 text-sm font-semibold text-muted-foreground"
                  >
                    {isExpanded ? 'Свернуть' : 'Подробнее'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </StateWrapper>
    </div>
  )
}
