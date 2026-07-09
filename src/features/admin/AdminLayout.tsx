import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

function AdminPageFallback() {
  return <div className="px-4 py-6 text-sm text-slate-600">Загрузка страницы...</div>
}

export function AdminLayout() {
  const location = useLocation()

  return (
    <main className="min-h-screen flex-1 pb-24">
      <Suspense key={location.key} fallback={<AdminPageFallback />}>
        <Outlet />
      </Suspense>
    </main>
  )
}
