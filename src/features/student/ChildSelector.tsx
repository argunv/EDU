import { UserAvatar } from '../../components/shared/UserAvatar'
import { useAuth } from '../auth/useAuth'
import { useChildSelection } from './useChildSelection'

type ChildPickerProps = {
  /** Заголовок блока. По умолчанию «Ребёнок». */
  title?: string
}

export function ChildSelector({ title = 'Ребёнок' }: ChildPickerProps) {
  const { user } = useAuth()
  const { childId, setChildId, children, isChildrenLoading, isChildrenError } = useChildSelection()

  if (!user || user.role !== 'parent') {
    return null
  }

  if (isChildrenError) {
    return (
      <div
        className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        role="alert"
      >
        Не удалось загрузить список детей. Проверьте соединение и обновите страницу.
      </div>
    )
  }

  if (isChildrenLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Загрузка списка детей…
      </div>
    )
  }

  if (children.length === 0) {
    return (
      <div
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
        role="status"
      >
        Нет привязанных детей. Обратитесь к администратору школы, чтобы привязать ребёнка к вашему
        аккаунту.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-3 flex flex-col gap-2">
        {children.map((child) => {
          const isActive = childId === child.id
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => setChildId(child.id)}
              className={`flex h-14 items-center gap-3 rounded-xl border px-3 text-left transition-colors ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:bg-accent'
              }`}
            >
              <UserAvatar
                name={child.name}
                avatarUrl={child.avatarUrl}
                size="md"
                className={isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {child.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {child.className || 'Класс не указан'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
