import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ROLE_HOME } from '../../lib/roleHome'
import { useAuth } from './useAuth'

export function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { user, login: doLogin } = useAuth()
  const navigate = useNavigate()

  const valid = login.trim().length > 0 && password.length > 0

  useEffect(() => {
    if (user) {
      navigate(ROLE_HOME[user.role], { replace: true })
    }
  }, [navigate, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!valid) return
    setLoading(true)
    try {
      await doLogin({ login: login.trim(), password })
      // Редирект выполнится в useEffect при обновлении user
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-center text-xl font-semibold text-slate-900">Вход</h1>

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
          <label htmlFor="login-field" className="block text-sm font-medium text-slate-700">
            Логин (email)
          </label>
          <input
            id="login-field"
            type="text"
            inputMode="email"
            autoComplete="username email"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="mt-1 block h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            placeholder="example@mail.ru"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password-field" className="block text-sm font-medium text-slate-700">
            Пароль
          </label>
          <div className="relative mt-1">
            <input
              id="password-field"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block h-12 w-full rounded-lg border border-slate-200 bg-white py-3 pl-3 pr-12 text-base text-slate-900"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-2 text-slate-500 hover:bg-slate-100"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!valid || loading}
          className="h-12 w-full rounded-lg bg-slate-900 text-base font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Вход…' : 'Войти'}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-center text-sm">
        <Link
          to="/auth/forgot-password"
          className="font-medium text-slate-600 underline hover:text-slate-900"
        >
          Забыли пароль?
        </Link>
        <Link
          to="/auth/register"
          className="font-medium text-slate-600 underline hover:text-slate-900"
        >
          Нет аккаунта? Регистрация
        </Link>
      </div>
    </div>
  )
}
