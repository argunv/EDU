import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type PageHeaderProps = {
  title: string
  subtitle?: string
  backTo?: string
}

export function PageHeader({ title, subtitle, backTo }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {backTo && (
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          <ArrowLeft className="size-4" />
          Назад
        </button>
      )}
    </div>
  )
}
