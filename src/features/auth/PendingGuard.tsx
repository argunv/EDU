import { Navigate } from 'react-router-dom'

import { ROLE_HOME } from '../../lib/roleHome'
import { useAuth } from './useAuth'
import { PendingPage } from './PendingPage'

export function PendingGuard() {
  const { user, ready } = useAuth()

  if (!ready) {
    return (
      <div className="px-4 py-6 text-sm text-slate-600">Загрузка...</div>
    )
  }
  if (!user) {
    return <Navigate to="/auth/login" replace />
  }
  if (user.role !== 'pending') {
    return <Navigate to={ROLE_HOME[user.role]} replace />
  }
  return <PendingPage />
}
