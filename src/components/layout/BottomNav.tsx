import { BookOpen, CalendarDays, GraduationCap, LayoutGrid, UserCircle2, Users } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { type Role } from '../../types/user'

type BottomNavProps = {
  role: Role
}

const NAV_ITEMS: Record<
  Role,
  Array<{ label: string; path: string; Icon: typeof CalendarDays }>
> = {
  teacher: [
    { label: 'Сегодня', path: '/teacher/today', Icon: CalendarDays },
    { label: 'Журнал', path: '/teacher/journal', Icon: BookOpen },
    { label: 'Профиль', path: '/profile', Icon: UserCircle2 },
  ],
  student: [
    { label: 'Расписание', path: '/me/schedule', Icon: CalendarDays },
    { label: 'ДЗ', path: '/me/homework', Icon: BookOpen },
    { label: 'Прогресс', path: '/me/progress', Icon: GraduationCap },
    { label: 'Профиль', path: '/profile', Icon: UserCircle2 },
  ],
  parent: [
    { label: 'Расписание', path: '/me/schedule', Icon: CalendarDays },
    { label: 'ДЗ', path: '/me/homework', Icon: BookOpen },
    { label: 'Прогресс', path: '/me/progress', Icon: GraduationCap },
    { label: 'Профиль', path: '/profile', Icon: UserCircle2 },
  ],
  admin: [
    { label: 'Классы', path: '/admin/classes', Icon: LayoutGrid },
    { label: 'Предметы', path: '/admin/subjects', Icon: BookOpen },
    { label: 'Пользователи', path: '/admin/users', Icon: Users },
  ],
  pending: [],
  rejected: [],
}

export function BottomNav({ role }: BottomNavProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const items = NAV_ITEMS[role]

  if (!items.length) {
    return null
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-around gap-2 px-3 py-2">
        {items.map((item) => {
          const isActive = location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-semibold ${
                isActive
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <item.Icon className="size-6" />
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
