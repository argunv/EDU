import { useNavigate } from 'react-router-dom'

import { useAuth } from './useAuth'

export function PendingPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user || user.role !== 'pending') {
    return null
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Ожидайте одобрения</h1>
        <p className="mt-3 text-sm text-slate-600">
          Ваша регистрация отправлена администратору. После одобрения вы получите доступ в систему.
        </p>
        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/auth/login', { replace: true })
          }}
          className="mt-6 h-12 w-full rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-700"
        >
          Выйти
        </button>
      </div>
    </div>
  )
}
