type WeekNavigatorProps = {
  label: string
  onPrev: () => void
  onNext: () => void
  /** Разрешить «назад» (если false — кнопка неактивна, в расписании — граница учебного года) */
  canGoPrev?: boolean
  /** Разрешить «вперёд» (если false — кнопка неактивна) */
  canGoNext?: boolean
  /** Показать кнопку «Сброс даты», если передан (когда открыта не текущая неделя) */
  onCurrentWeek?: () => void
}

export function WeekNavigator({
  label,
  onPrev,
  onNext,
  canGoPrev = true,
  canGoNext = true,
  onCurrentWeek,
}: WeekNavigatorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          className="h-11 w-12 shrink-0 rounded-lg border border-slate-200 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:border-zinc-600 dark:bg-zinc-700 dark:text-slate-100 dark:hover:bg-zinc-600 dark:disabled:hover:bg-zinc-700"
          aria-label="Предыдущая неделя"
        >
          ←
        </button>
        <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-100">
          {label}
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="h-11 w-12 shrink-0 rounded-lg border border-slate-200 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:border-zinc-600 dark:bg-zinc-700 dark:text-slate-100 dark:hover:bg-zinc-600 dark:disabled:hover:bg-zinc-700"
          aria-label="Следующая неделя"
        >
          →
        </button>
      </div>
      {onCurrentWeek ? (
        <button
          type="button"
          onClick={onCurrentWeek}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-700"
        >
          Сброс даты
        </button>
      ) : null}
    </div>
  )
}
