import { Minus, Plus } from 'lucide-react'

type ScheduleLessonCountControlProps = {
  lessonCount: number
  onDecrease: () => void
  onIncrease: () => void
  variant?: 'desktop' | 'mobile'
}

export function ScheduleLessonCountControl({
  lessonCount,
  onDecrease,
  onIncrease,
  variant = 'desktop',
}: ScheduleLessonCountControlProps) {
  const isMobile = variant === 'mobile'
  return (
    <div
      className={
        isMobile
          ? 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4'
          : 'flex flex-wrap items-center gap-3'
      }
    >
      <span
        className={
          isMobile
            ? 'text-base font-semibold text-slate-900'
            : 'text-sm font-semibold text-slate-700'
        }
      >
        Уроков в неделю:
      </span>
      <div
        className={
          isMobile
            ? 'inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'
            : 'inline-flex shrink-0 items-center gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'
        }
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDecrease()
          }}
          disabled={lessonCount <= 1}
          className={
            isMobile
              ? 'inline-flex h-12 min-w-[48px] cursor-pointer items-center justify-center text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'
              : 'inline-flex h-11 min-w-[44px] cursor-pointer items-center justify-center px-3 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'
          }
          aria-label="Уменьшить"
        >
          <Minus className="size-5" />
        </button>
        <span
          className={
            isMobile
              ? 'min-w-[3rem] text-center text-lg font-semibold text-slate-900'
              : 'min-w-[2.5rem] text-center text-sm font-semibold text-slate-900'
          }
        >
          {lessonCount}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onIncrease()
          }}
          disabled={lessonCount >= 7}
          className={
            isMobile
              ? 'inline-flex h-12 min-w-[48px] cursor-pointer items-center justify-center text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'
              : 'inline-flex h-11 min-w-[44px] cursor-pointer items-center justify-center px-3 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'
          }
          aria-label="Увеличить"
        >
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  )
}
