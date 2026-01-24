import { Outlet } from 'react-router-dom'

/**
 * Минимальный layout для страниц /auth/*: одна колонка, контент по центру.
 * Без AppShell (хедер/нав).
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}
