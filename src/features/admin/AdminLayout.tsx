import { Outlet } from 'react-router-dom'

export function AdminLayout() {
  return (
    <main className="min-h-screen flex-1 pb-24">
      <Outlet />
    </main>
  )
}
