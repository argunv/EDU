import { type Grade } from '../../types/lesson'

type GradeBadgeProps = {
  value: Grade
}

export function GradeBadge({ value }: GradeBadgeProps) {
  return (
    <span className="inline-flex min-w-10 items-center justify-center rounded-full border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-900">
      {value ?? '—'}
    </span>
  )
}
