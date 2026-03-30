import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'

export function RouteErrorBoundary() {
  const error = useRouteError()

  let title = 'Что-то пошло не так'
  let description = 'Во время загрузки страницы произошла ошибка.'

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText || 'Ошибка'}`
    description = typeof error.data === 'string' ? error.data : description
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
      <Link
        to="/"
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
      >
        На главную
      </Link>
    </div>
  )
}
