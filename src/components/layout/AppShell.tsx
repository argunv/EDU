import { LogOut, Moon, Sun } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { HeaderBackProvider } from '../../contexts/HeaderBackProvider'
import { type BackTarget } from '../../contexts/headerBack'
import { useAuth } from '../../features/auth/useAuth'
import { BottomNav } from './BottomNav'
import { Toaster } from '../ui/sonner'

const THEME_STORAGE_KEY = 'abh-edu-theme'

function pathBasedBack(pathname: string): BackTarget | null {
  if (pathname.startsWith('/admin/journal')) return { type: 'href', href: '/admin/classes' }
  if (pathname === '/admin/subjects' || pathname === '/admin/users' || pathname === '/admin/schedule') return { type: 'href', href: '/admin/classes' }
  if (pathname.match(/^\/teacher\/journal\/[^/]+$/)) return { type: 'href', href: '/teacher/today' }
  return null
}

export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [contextBack, setContextBack] = useState<BackTarget | null>(null)
  const [backAnchorPath, setBackAnchorPath] = useState<string | null>(null)
  const setBackTarget = useCallback((v: BackTarget | null) => {
    setContextBack(v)
    setBackAnchorPath(v ? window.location.pathname : null)
  }, [])

  const pathBack = useMemo(() => pathBasedBack(location.pathname), [location.pathname])
  const backTarget = useMemo(
    () =>
      (contextBack && backAnchorPath === location.pathname ? contextBack : null) ??
      pathBack,
    [contextBack, backAnchorPath, location.pathname, pathBack],
  )
  const handleBackClick = useCallback(() => {
    if (!backTarget) return
    if (backTarget.type === 'href') navigate(backTarget.href)
    else backTarget.onBack()
  }, [backTarget, navigate])
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const isTeacherLesson = location.pathname.startsWith('/teacher/lesson/')
  const showNav =
    Boolean(user) &&
    user?.role !== 'teacher' &&
    user?.role !== 'pending' &&
    user?.role !== 'rejected' &&
    !isTeacherLesson
  const showHeaderBar =
    Boolean(user) &&
    user?.role !== 'pending' &&
    user?.role !== 'rejected' &&
    !isTeacherLesson

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  const isAuthPage = location.pathname.startsWith('/auth')
  if (isAuthPage) {
    return (
      <div className="min-h-dvh bg-white text-slate-900">
        <main className="min-h-dvh">
          <Outlet />
        </main>
        <Toaster />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      {showHeaderBar && user ? (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:border-zinc-600 dark:bg-zinc-800/95">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-3 items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex items-center justify-start">
              {backTarget ? (
                <button
                  type="button"
                  onClick={handleBackClick}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 px-4 text-base font-semibold text-slate-900 dark:text-slate-100"
                  aria-label="Назад"
                >
                  <span aria-hidden>←</span>
                  Назад
                </button>
              ) : null}
            </div>
            <Link
              to="/profile"
              className="flex min-w-0 flex-col items-center text-center no-underline"
              aria-label="Открыть профиль"
              title="Открыть профиль"
            >
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {user.role === 'admin'
                  ? 'Администратор'
                  : user.role === 'teacher'
                    ? 'Учитель'
                    : 'Пользователь'}
              </span>
              <span className="block truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                {user.name}
              </span>
            </Link>

            <div className="flex shrink-0 items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDark((prev) => !prev)}
                className="inline-flex h-12 min-w-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-slate-100 dark:hover:bg-zinc-600"
                aria-label={isDark ? 'Включить светлую тему' : 'Включить темную тему'}
                title={isDark ? 'Светлая тема' : 'Темная тема'}
              >
                {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  logout()
                  navigate('/auth/login', { replace: true })
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-red-600 dark:border-zinc-600 dark:bg-zinc-700 dark:text-slate-100 dark:hover:bg-zinc-600 dark:hover:text-red-400"
                aria-label="Выйти"
                title="Выйти"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </div>
          </div>
        </header>
      ) : null}
      <main className={`min-h-dvh ${showNav ? 'pb-20' : ''}`}>
        <HeaderBackProvider setBackTarget={setBackTarget}>
          <Outlet />
        </HeaderBackProvider>
      </main>
      {showNav && user ? <BottomNav role={user.role} /> : null}
      <Toaster />
    </div>
  )
}
