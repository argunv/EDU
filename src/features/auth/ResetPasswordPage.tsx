import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { apiResetPassword } from '../../api/auth'

const MIN_PASSWORD_LENGTH = 6

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const validToken = token.trim().length >= 10
  const passwordsMatch = password === passwordRepeat
  const passwordOk = password.length >= MIN_PASSWORD_LENGTH
  const valid = validToken && passwordOk && passwordsMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!valid) return
    setLoading(true)
    try {
      await apiResetPassword({ token, password })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения пароля')
    } finally {
      setLoading(false)
    }
  }

  if (!validToken) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-slate-900">Сброс пароля</h1>
        <p className="mt-4 text-center text-sm text-slate-600">
          Ссылка недействительна или устарела. Запросите сброс пароля снова.
        </p>
        <Link
          to="/auth/forgot-password"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-slate-900 text-base font-semibold text-white"
        >
          Запросить сброс пароля
        </Link>
        <p className="mt-4 text-center text-sm text-slate-600">
          <Link to="/auth/login" className="font-medium underline hover:text-slate-900">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-slate-900">Пароль сохранён</h1>
        <p className="mt-4 text-center text-sm text-slate-600">
          Теперь вы можете войти с новым паролем.
        </p>
        <Link
          to="/auth/login"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-slate-900 text-base font-semibold text-white"
        >
          Войти
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-center text-xl font-semibold text-slate-900">Новый пароль</h1>

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
          <label htmlFor="reset-password" className="block text-sm font-medium text-slate-700">
            Новый пароль
          </label>
          <div className="relative mt-1">
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
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
          {password.length > 0 && !passwordOk ? (
            <p className="mt-1 text-xs text-rose-600">
              Минимум {MIN_PASSWORD_LENGTH} символов
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="reset-repeat" className="block text-sm font-medium text-slate-700">
            Повтор пароля
          </label>
          <input
            id="reset-repeat"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            className="mt-1 block h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            disabled={loading}
          />
          {passwordRepeat.length > 0 && !passwordsMatch ? (
            <p className="mt-1 text-xs text-rose-600">Пароли не совпадают</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!valid || loading}
          className="h-12 w-full rounded-lg bg-slate-900 text-base font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Сохранение…' : 'Сохранить пароль'}
        </button>
      </form>
    </div>
  )
}
