import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'

import { getAdminClasses } from '../../api/admin'
import {
  getAdminPendingUsers,
  getAdminAllUsers,
  getAdminAllStudents,
  getAdminAllSubjects,
  approveAdminUser,
  patchAdminUserRole,
  rejectAdminUser,
  type ApprovePayload,
} from '../../api/adminUsers'
import { StateWrapper } from '../../components/shared/StateWrapper'
import type { AdminUser } from '../../types/user'
import type { ApprovedRole } from '../../types/user'

const ROLE_LABELS: Record<ApprovedRole, string> = {
  teacher: 'Учитель',
  student: 'Ученик',
  parent: 'Родитель',
  admin: 'Администратор',
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

type Tab = 'pending' | 'all'

type RoleFilter = '' | ApprovedRole

const ROLE_FILTER_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'admin', label: 'Администратор' },
  { value: 'teacher', label: 'Учитель' },
  { value: 'student', label: 'Ученик' },
  { value: 'parent', label: 'Родитель' },
]

type AssignRoleModalProps = {
  user: AdminUser
  onClose: () => void
  onSuccess: () => void
  isEdit?: boolean
}

function AssignRoleModal({ user, onClose, onSuccess, isEdit }: AssignRoleModalProps) {
  const [role, setRole] = useState<ApprovedRole>(() => {
    if (user.role === 'teacher' || user.role === 'student' || user.role === 'parent') return user.role
    return 'student'
  })
  const [classId, setClassId] = useState<string>(user.classId ?? '')
  const [classIds, setClassIds] = useState<string[]>(user.classIds ?? [])
  const [subjectIds, setSubjectIds] = useState<string[]>(user.subjectIds ?? [])
  const [childIds, setChildIds] = useState<string[]>(user.childIds ?? [])
  const [childSearchQuery, setChildSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const queryClient = useQueryClient()

  const { data: classes = [] } = useQuery({
    queryKey: ['admin', 'classes'],
    queryFn: () => getAdminClasses(),
  })
  const { data: students = [] } = useQuery({
    queryKey: ['admin', 'students'],
    queryFn: getAdminAllStudents,
  })
  const { data: subjects = [] } = useQuery({
    queryKey: ['admin', 'subjects'],
    queryFn: getAdminAllSubjects,
  })

  const studentsFiltered = useMemo(() => {
    const q = childSearchQuery.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q))
  }, [students, childSearchQuery])

  const toggleClassId = (id: string) => {
    setClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const toggleSubjectId = (id: string) => {
    setSubjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const toggleChildId = (id: string) => {
    setChildIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setShowFieldErrors(false)
  }

  const valid =
    role === 'teacher' ||
    (role === 'student' && classId) ||
    (role === 'parent' && childIds.length >= 1)

  const handleSubmit = async () => {
    if (!valid) {
      setShowFieldErrors(true)
      toast.error('Заполните обязательные поля')
      return
    }
    setShowFieldErrors(false)
    setLoading(true)
    try {
      const payload: ApprovePayload = { role }
      if (role === 'student') payload.classId = classId
      if (role === 'parent') payload.childIds = childIds
      if (role === 'teacher') {
        payload.classIds = classIds.length ? classIds : undefined
        payload.subjectIds = subjectIds.length ? subjectIds : undefined
      }
      if (isEdit) {
        await patchAdminUserRole(user.id, payload)
      } else {
        await approveAdminUser(user.id, payload)
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(isEdit ? 'Роль обновлена' : 'Пользователь одобрен')
      onSuccess()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-modal-title"
      >
        <h2 id="role-modal-title" className="text-lg font-semibold text-slate-900">
          {isEdit ? 'Изменить роль' : 'Назначить роль'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{user.name}</p>

        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Роль</p>
          <div className="flex flex-wrap gap-2">
            {(['teacher', 'student', 'parent'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`h-11 rounded-lg border px-4 text-sm font-semibold ${
                  role === r
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {role === 'student' && (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700">Класс (обязательно)</p>
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setShowFieldErrors(false) }}
              className={`mt-1 block h-12 w-full rounded-lg border bg-white px-3 text-base ${
                showFieldErrors && !classId ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'
              }`}
            >
              <option value="">Выберите класс</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {role === 'teacher' && (
          <>
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">Классы</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {classes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClassId(c.id)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      classIds.includes(c.id)
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">Предметы</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubjectId(s.id)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      subjectIds.includes(s.id)
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {role === 'parent' && (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Дети (минимум 1)</p>
            <input
              type="text"
              value={childSearchQuery}
              onChange={(e) => setChildSearchQuery(e.target.value)}
              placeholder="Поиск по ФИО или классу"
              className="mt-1 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
            <div
              className={`mt-2 max-h-48 overflow-y-auto rounded-lg border dark:border-slate-600 dark:bg-slate-800/50 ${
                showFieldErrors && childIds.length < 1 ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'
              }`}
            >
              {studentsFiltered.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">Никого не найдено</div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-600">
                  {studentsFiltered.map((s) => {
                    const selected = childIds.includes(s.id)
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => toggleChildId(s.id)}
                          className={`flex w-full items-center gap-3 px-3 py-3 text-left text-base ${
                            selected
                              ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                              : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                              selected
                                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                                : 'border-slate-300 dark:border-slate-500'
                            }`}
                          >
                            {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                          <span className="flex-1">{s.name}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">{s.className}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {childIds.length < 1 && (
              <p className={`mt-1 text-xs text-rose-600 dark:text-rose-400 ${showFieldErrors ? 'font-semibold' : ''}`}>
                Выберите хотя бы одного ребёнка
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-700"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="h-12 flex-1 rounded-lg bg-slate-900 text-base font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Сохранение…' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function matchesSearch(user: { name: string; email?: string | null }, q: string): boolean {
  const trimmed = q.trim().toLowerCase()
  if (!trimmed) return true
  const nameMatch = (user.name ?? '').toLowerCase().includes(trimmed)
  const emailMatch = (user.email ?? '').toLowerCase().includes(trimmed)
  return nameMatch || emailMatch
}

export function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('')
  const [assignUser, setAssignUser] = useState<AdminUser | null>(null)
  const [assignIsEdit, setAssignIsEdit] = useState(false)
  const queryClient = useQueryClient()

  const pendingQuery = useQuery({
    queryKey: ['admin', 'users', 'pending'],
    queryFn: getAdminPendingUsers,
  })
  const allQuery = useQuery({
    queryKey: ['admin', 'users', 'all'],
    queryFn: getAdminAllUsers,
  })

  const rejectMutation = useMutation({
    mutationFn: rejectAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Заявка отклонена')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const handleReject = (user: AdminUser) => {
    if (!window.confirm(`Отклонить заявку от ${user.name}?`)) return
    rejectMutation.mutate(user.id)
  }

  const openAssign = (user: AdminUser, isEdit: boolean) => {
    setAssignUser(user)
    setAssignIsEdit(isEdit)
  }

  const { data: classesList = [] } = useQuery({
    queryKey: ['admin', 'classes'],
    queryFn: () => getAdminClasses(),
  })
  const classById = useMemo(() => {
    const m: Record<string, string> = {}
    classesList.forEach((c) => { m[c.id] = c.name })
    return m
  }, [classesList])

  const pendingFiltered = useMemo(() => {
    const list = pendingQuery.data ?? []
    return list.filter((u) => matchesSearch(u, searchQuery))
  }, [pendingQuery.data, searchQuery])

  const allFiltered = useMemo(() => {
    const list = allQuery.data ?? []
    return list.filter((u) => {
      if (!matchesSearch(u, searchQuery)) return false
      if (roleFilter && u.role !== roleFilter) return false
      return true
    })
  }, [allQuery.data, searchQuery, roleFilter])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex min-h-[56px] items-center justify-center border-b border-slate-200 bg-white py-4 dark:border-zinc-600 dark:bg-zinc-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Пользователи
        </h1>
      </header>

      <div className="flex gap-0 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`min-h-[44px] flex-1 rounded-t-lg border border-b-0 px-4 text-base font-semibold ${
            tab === 'pending'
              ? 'border-slate-200 border-b-white bg-white text-slate-900 -mb-px'
              : 'border-transparent bg-transparent text-slate-600 hover:bg-slate-50'
          }`}
        >
          Новые заявки
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`min-h-[44px] flex-1 rounded-t-lg border border-b-0 px-4 text-base font-semibold ${
            tab === 'all'
              ? 'border-slate-200 border-b-white bg-white text-slate-900 -mb-px'
              : 'border-transparent bg-transparent text-slate-600 hover:bg-slate-50'
          }`}
        >
          Все пользователи
        </button>
      </div>

      <div className="border-b border-slate-200 bg-white py-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по ФИО или email"
          aria-label="Поиск по ФИО или email"
          className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
        {tab === 'all' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ROLE_FILTER_OPTIONS.map(({ value, label }) => (
              <button
                key={value || 'all'}
                type="button"
                onClick={() => setRoleFilter(value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  roleFilter === value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'pending' && (
        <StateWrapper
          isLoading={pendingQuery.isLoading}
          isError={pendingQuery.isError}
          isEmpty={!pendingQuery.isLoading && !pendingQuery.isError && pendingFiltered.length === 0}
          onRetry={() => pendingQuery.refetch()}
          emptyTitle={searchQuery.trim() ? 'Ничего не найдено' : 'Нет новых заявок'}
          emptyDescription={searchQuery.trim() ? 'Попробуйте другой запрос.' : 'Заявки на регистрацию появятся здесь.'}
        >
          <div className="flex flex-col gap-3">
            {pendingFiltered.map((u) => (
              <div
                key={u.id}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="text-base font-semibold text-slate-900">{u.name}</div>
                <div className="mt-1 text-base text-slate-600">{u.email ?? '—'}</div>
                <div className="mt-1 text-sm text-slate-500">{formatDate(u.createdAt)}</div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openAssign(u, false)}
                    className="h-11 flex-1 rounded-lg bg-slate-900 text-sm font-semibold text-white"
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(u)}
                    className="h-11 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700"
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </StateWrapper>
      )}

      {tab === 'all' && (
        <StateWrapper
          isLoading={allQuery.isLoading}
          isError={allQuery.isError}
          isEmpty={!allQuery.isLoading && !allQuery.isError && allFiltered.length === 0}
          onRetry={() => allQuery.refetch()}
          emptyTitle={
            searchQuery.trim() || roleFilter
              ? 'Ничего не найдено'
              : 'Нет пользователей'
          }
          emptyDescription={
            searchQuery.trim()
              ? 'Попробуйте другой запрос или фильтр.'
              : roleFilter
                ? 'Попробуйте другую роль или сбросьте фильтр.'
                : 'Одобренные пользователи появятся здесь.'
          }
        >
          <div className="flex flex-col gap-3">
            {allFiltered.map((u) => (
              <div
                key={u.id}
                className="flex min-h-[40px] items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-slate-900">{u.name}</div>
                  {u.email && (
                    <div className="mt-0.5 text-base text-slate-600">{u.email}</div>
                  )}
                  <div className="mt-0.5 text-base text-slate-700">
                    {u.role === 'admin' ? 'Администратор' : ROLE_LABELS[u.role as ApprovedRole]}
                    {u.classId && ` · Класс ${classById[u.classId] ?? u.classId}`}
                    {u.childIds && u.childIds.length > 0 && ` · Детей: ${u.childIds.length}`}
                    {u.classIds && u.classIds.length > 0 && ` · Классов: ${u.classIds.length}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAssign(u, true)}
                  className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Изменить роль
                </button>
              </div>
            ))}
          </div>
        </StateWrapper>
      )}

      {assignUser && (
        <AssignRoleModal
          user={assignUser}
          onClose={() => setAssignUser(null)}
          onSuccess={() => setAssignUser(null)}
          isEdit={assignIsEdit}
        />
      )}
    </div>
  )
}
