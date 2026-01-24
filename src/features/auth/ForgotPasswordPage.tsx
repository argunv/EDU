import { useState } from 'react'
import { Link } from 'react-router-dom'

import { apiForgotPassword } from '../../api/auth'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = email.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!valid) return
    setLoading(true)
    try {
      await apiForgotPassword({ email: email.trim() })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-slate-900">Восстановление пароля</h1>
        <p className="mt-4 text-center text-sm text-slate-600">
          Если аккаунт с таким email существует, на него отправлена инструкция по сбросу пароля.
        </p>
        <Link
          to="/auth/login"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-700"
        >
          Вернуться ко входу
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-center text-xl font-semibold text-slate-900">Забыли пароль?</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        Введите email — мы отправим ссылку для сброса пароля.
      </p>

      {error ? (
        <div
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            placeholder="example@mail.ru"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={!valid || loading}
          className="h-12 w-full rounded-lg bg-slate-900 text-base font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Отправка…' : 'Отправить'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link to="/auth/login" className="font-medium underline hover:text-slate-900">
          Вернуться ко входу
        </Link>
      </p>
    </div>
  )
}
