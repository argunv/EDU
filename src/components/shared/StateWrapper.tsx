import { type ReactNode } from 'react'

import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Skeleton } from '../ui/skeleton'

type StateWrapperProps = {
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  children: ReactNode
}

export function StateWrapper({
  isLoading,
  isError,
  isEmpty,
  onRetry,
  emptyTitle = 'Нет данных',
  emptyDescription = 'Попробуйте позже или обновите страницу.',
  emptyAction,
  children,
}: StateWrapperProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert className="border-rose-200 bg-rose-50 text-rose-800">
        <AlertTitle className="text-rose-800">Ошибка</AlertTitle>
        <AlertDescription className="mt-2 text-rose-700">
          Не удалось загрузить данные.
        </AlertDescription>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white"
          >
            Повторить
          </button>
        )}
      </Alert>
    )
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
        <div className="text-base font-semibold text-slate-900">{emptyTitle}</div>
        <div className="mt-1 text-sm text-slate-600">{emptyDescription}</div>
        {emptyAction && <div className="mt-3">{emptyAction}</div>}
      </div>
    )
  }

  return <>{children}</>
}
