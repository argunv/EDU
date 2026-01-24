import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { apiRegister } from '../../api/auth'
import { useAuth } from './useAuth'

const MIN_LEN = 6

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setUserFromToken } = useAuth()
  const navigate = useNavigate()

  const match = password === passwordRepeat
  const ok = password.length >= MIN_LEN
  const valid = name.trim().length > 0 && email.trim().length > 0 && ok && match

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!valid) return
    setLoading(true)
    try {
      const res = await apiRegister({
        name: name.trim(),
        email: email.trim(),
        password,
      })
      setUserFromToken(res.accessToken, res.user)
      navigate('/me/schedule', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-center text-xl font-semibold text-slate-900">Регистрация</h1>
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700">ФИО</label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            placeholder="Иванов Иван Иванович"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700">Email</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            placeholder="example@mail.ru"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="reg-pw" className="block text-sm font-medium text-slate-700">Пароль</label>
          <div className="relative mt-1">
            <input
              id="reg-pw"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-slate-500 hover:bg-slate-100"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          {password.length > 0 && !ok && <p className="mt-1 text-xs text-rose-600">Минимум {MIN_LEN} символов</p>}
        </div>
        <div>
          <label htmlFor="reg-pw2" className="block text-sm font-medium text-slate-700">Повтор пароля</label>
          <input
            id="reg-pw2"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            className="mt-1 block h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            disabled={loading}
          />
          {passwordRepeat.length > 0 && !match && <p className="mt-1 text-xs text-rose-600">Пароли не совпадают</p>}
        </div>
        <button
          type="submit"
          disabled={!valid || loading}
          className="h-12 w-full rounded-lg bg-slate-900 text-base font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Создание…' : 'Создать аккаунт'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link to="/auth/login" className="font-medium underline hover:text-slate-900">Уже есть аккаунт? Войти</Link>
      </p>
    </div>
  )
}
