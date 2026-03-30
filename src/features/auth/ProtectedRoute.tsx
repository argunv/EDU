import { Navigate, Outlet } from 'react-router-dom'

import { type Role } from '../../types/user'
import { useAuth } from './useAuth'

const ROLE_HOME: Record<Role, string> = {
  teacher: '/teacher/today',
  student: '/me/schedule',
  parent: '/me/schedule',
  admin: '/admin/classes',
  pending: '/pending',
  rejected: '/auth/login',
}

type ProtectedRouteProps = {
  allowedRoles: Role[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, ready } = useAuth()

  if (!ready) {
    return (
      <div className="px-4 py-6 text-sm text-slate-600">Загрузка...</div>
    )
  }
  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />
  }

  return <Outlet />
}
