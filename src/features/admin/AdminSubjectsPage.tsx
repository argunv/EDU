import { BookOpen, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createAdminSubject,
  deleteAdminSubject,
  getAdminSubjects,
} from '../../api/admin'
import { StateWrapper } from '../../components/shared/StateWrapper'

export function AdminSubjectsPage() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [showFieldErrors, setShowFieldErrors] = useState(false)

  const { data: subjects, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'subjects'],
    queryFn: getAdminSubjects,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => createAdminSubject(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] })
      setNewName('')
      toast.success('Предмет добавлен')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Не удалось добавить предмет')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (subjectId: string) => deleteAdminSubject(subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] })
      toast.success('Предмет удалён')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Не удалось удалить предмет')
    },
  })

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      setShowFieldErrors(true)
      toast.error('Введите название предмета')
      return
    }
    setShowFieldErrors(false)
    createMutation.mutate(name)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="relative flex min-h-[56px] items-center justify-center border-b border-slate-200 bg-white py-4 dark:border-zinc-600 dark:bg-zinc-900">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
          <BookOpen className="size-6 shrink-0" aria-hidden />
          Предметы
        </h1>
      </header>

      <form onSubmit={handleAddSubject} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">Добавить предмет</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setShowFieldErrors(false) }}
            placeholder="Название предмета"
            className={`flex-1 rounded-lg border px-3 py-2 text-base ${
              showFieldErrors && !newName.trim() ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'
            }`}
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newName.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {createMutation.isPending ? '…' : 'Добавить'}
          </button>
        </div>
      </form>

      <StateWrapper
        isLoading={isLoading}
        isError={isError}
        isEmpty={!isLoading && !isError && (!subjects || subjects.length === 0)}
        onRetry={refetch}
        emptyTitle="Нет предметов"
        emptyDescription="Добавьте первый предмет с помощью формы выше."
      >
        <ul className="flex flex-col gap-2">
          {subjects?.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span className="font-medium text-slate-900">{s.name}</span>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `Удалить предмет «${s.name}»?\n\nБудут удалены: слоты во всех расписаниях, привязка к классам, право вести этот предмет у всех преподавателей, оценки и ДЗ по предмету.`
                    )
                  ) {
                    deleteMutation.mutate(s.id)
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label="Удалить предмет"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      </StateWrapper>
    </div>
  )
}
