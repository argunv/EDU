import { Navigate } from 'react-router-dom'

import { type Role } from '../../types/user'
import { useAuth } from './useAuth'
import { PendingPage } from './PendingPage'

const ROLE_HOME: Record<Role, string> = {
  teacher: '/teacher/today',
  student: '/me/schedule',
  parent: '/me/schedule',
  admin: '/admin/classes',
  pending: '/pending',
  rejected: '/auth/login',
}

export function PendingGuard() {
  const { user, ready } = useAuth()

  if (!ready) {
    return null
  }
  if (!user) {
    return <Navigate to="/auth/login" replace />
  }
  if (user.role !== 'pending') {
    return <Navigate to={ROLE_HOME[user.role]} replace />
  }
  return <PendingPage />
}
