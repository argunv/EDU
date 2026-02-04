type ScheduleSaveBarProps = {
  changeCount: number
  onSave: () => void
  onReset: () => void
}

export function ScheduleSaveBar({ changeCount, onSave, onReset }: ScheduleSaveBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="text-sm font-semibold text-foreground">
          Несохранённые изменения: <span className="text-foreground">{changeCount}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onReset}
            className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Отменить
          </button>
        </div>
      </div>
    </div>
  )
}
