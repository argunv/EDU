import { Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHeaderBack } from '../../contexts/useHeaderBack'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { useClassesPageData, type ClassItem } from './hooks/useClassesPageData'

function getCurrentSchoolYear(): number {
  const now = new Date()
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

const CLASS_LETTERS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ'.split('')

function CreateClassModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void
  onSubmit: (params: {
    yearStart: number
    grade: number
    letter: string
    shift?: string
    shiftLocked?: boolean
    maxLessonsPerWeek?: number | null
  }) => void
  isSubmitting: boolean
}) {
  const [grade, setGrade] = useState(5)
  const [letter, setLetter] = useState('А')
  const selectBase =
    'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-500 dark:focus:ring-offset-slate-900'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-class-title"
      >
        <h3 id="create-class-title" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Создать класс
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Номер класса
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className={selectBase}
            >
              {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Буква
            </label>
            <select
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              className={selectBase}
            >
              {CLASS_LETTERS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmit({
                yearStart: getCurrentSchoolYear(),
                grade,
                letter: letter.trim() || 'А',
                shift: 'morning',
                shiftLocked: false,
                maxLessonsPerWeek: null,
              })
            }
            disabled={isSubmitting}
            className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {isSubmitting ? '…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditClassModal({
  classItem,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  classItem: ClassItem
  onClose: () => void
  onSubmit: (params: {
    shift?: string
    shiftLocked?: boolean
    maxLessonsPerWeek?: number | null
  }) => void
  isSubmitting: boolean
}) {
  const [maxLessonsPerWeek, setMaxLessonsPerWeek] = useState<string>(
    classItem.maxLessonsPerWeek != null ? String(classItem.maxLessonsPerWeek) : ''
  )
  const inputBase =
    'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-class-title"
      >
        <h3 id="edit-class-title" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Редактировать класс {classItem.name}
        </h3>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Учебный год: {classItem.yearStart}, класс: {classItem.grade}{classItem.letter} (только для
          чтения)
        </p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Макс. уроков в неделю (необязательно)
            </label>
            <input
              type="number"
              min={0}
              value={maxLessonsPerWeek}
              onChange={(e) => setMaxLessonsPerWeek(e.target.value)}
              className={inputBase}
              placeholder="—"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmit({
                shift: classItem.shift ?? 'morning',
                shiftLocked: classItem.shiftLocked ?? false,
                maxLessonsPerWeek: maxLessonsPerWeek === '' ? null : Number(maxLessonsPerWeek) || null,
              })
            }
            disabled={isSubmitting}
            className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {isSubmitting ? '…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClassesPage() {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalClass, setEditModalClass] = useState<ClassItem | null>(null)
  const [showJournalSubjects, setShowJournalSubjects] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlClassId = searchParams.get('classId')
  const {
    classesQuery,
    displayData,
    effectiveSelectedId,
    selectedClass,
    classSubjectsQuery,
    createClassMutation,
    patchClassMutation,
    archiveClassMutation,
  } = useClassesPageData(includeArchived, selectedClassId, urlClassId)

  const effectiveShowJournalSubjects = showJournalSubjects

  const classesByLetter = useMemo(() => {
    const result: Record<string, Array<{ id: string; name: string; number: number }>> = {}
    if (!displayData.length) return result

    displayData.forEach((item) => {
      const letter = item.letter ?? ''
      const number = item.grade ?? 0
      if (!letter) return
      if (!result[letter]) {
        result[letter] = []
      }
      result[letter].push({ id: item.id, name: item.name, number })
    })

    Object.values(result).forEach((items) => {
      items.sort((a, b) => a.number - b.number)
    })

    return result
  }, [displayData])

  const availableLetters = useMemo(() => Object.keys(classesByLetter).sort(), [classesByLetter])
  const numberOptions = useMemo(() => {
    if (!selectedLetter) return []
    const items = classesByLetter[selectedLetter] ?? []
    const numbers = Array.from(new Set(items.map((item) => item.number))).sort((a, b) => a - b)
    return numbers
  }, [classesByLetter, selectedLetter])

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('classId', classId)
    setSearchParams(nextParams, { replace: true })
  }

  const showBack = Boolean(selectedLetter || effectiveSelectedId)
  const headerBack = useHeaderBack()

  const handleBack = useCallback(() => {
    if (effectiveSelectedId) {
      setSelectedClassId(null)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('classId')
      setSearchParams(nextParams, { replace: true })
      return
    }
    if (selectedLetter) {
      setSelectedLetter(null)
      return
    }
    navigate('/admin/classes')
  }, [effectiveSelectedId, selectedLetter, searchParams, setSearchParams, navigate])

  useEffect(() => {
    if (!headerBack) return
    if (showBack) headerBack.setBack(handleBack)
    else headerBack.clearBack()
    return () => headerBack.clearBack()
  }, [headerBack, showBack, handleBack])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex min-h-[56px] items-center justify-center border-b border-slate-200 bg-white py-4 dark:border-zinc-600 dark:bg-zinc-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {selectedClass ? `Класс: ${selectedClass.name}` : 'Выбор класса'}
        </h1>
      </header>

      <StateWrapper
        isLoading={classesQuery.isLoading}
        isError={classesQuery.isError}
        isEmpty={!classesQuery.isLoading && !classesQuery.isError && displayData.length === 0}
        onRetry={() => classesQuery.refetch()}
        emptyTitle={includeArchived ? 'Нет архивных классов' : 'Нет классов'}
        emptyDescription={
          includeArchived
            ? 'Архивных классов пока нет.'
            : 'Добавьте класс для учебного года.'
        }
        emptyAction={
          !includeArchived ? (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Plus className="h-4 w-4" />
              Создать класс
            </button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {selectedClass ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Класс: {selectedClass.name}
                  {selectedClass.archived ? (
                    <span className="ml-2 text-sm font-normal text-slate-500">(архив)</span>
                  ) : null}
                </span>
                {!selectedClass.archived ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditModalClass(selectedClass)}
                      className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Переместить класс в архив? Ученики и расписание сохранятся.')) {
                          archiveClassMutation.mutate(selectedClass.id, {
                            onSuccess: () => {
                              if (effectiveSelectedId === selectedClass.id) {
                                setSelectedClassId(null)
                                setSelectedLetter(null)
                                const nextParams = new URLSearchParams(searchParams)
                                nextParams.delete('classId')
                                setSearchParams(nextParams, { replace: true })
                              }
                            },
                          })
                        }
                      }}
                      disabled={archiveClassMutation.isPending}
                      className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-amber-200 dark:hover:bg-amber-950/30"
                    >
                      В архив
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShowJournalSubjects(true)}
                  className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  Посмотреть журнал
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/admin/schedule?classId=${selectedClass.id}`, { flushSync: true })
                  }
                  className="flex h-14 w-full items-center justify-center rounded-xl border border-slate-900 bg-slate-900 text-base font-semibold text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  Изменить расписание
                </button>
              </div>

              {effectiveShowJournalSubjects && (
                <StateWrapper
                  isLoading={classSubjectsQuery.isLoading}
                  isError={classSubjectsQuery.isError}
                  isEmpty={
                    !classSubjectsQuery.isLoading &&
                    !classSubjectsQuery.isError &&
                    (!classSubjectsQuery.data || classSubjectsQuery.data.length === 0)
                  }
                  onRetry={() => classSubjectsQuery.refetch()}
                  emptyTitle="Нет предметов"
                  emptyDescription="Для этого класса пока не заданы предметы."
                >
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(classSubjectsQuery.data ?? []).map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() =>
                          navigate(
                            `/admin/journal/${selectedClass.id}/${subject.id}`,
                            { flushSync: true },
                          )
                        }
                        className="flex min-h-16 flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                      >
                        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {subject.name}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          {subject.teachers?.length
                            ? subject.teachers.join('; ')
                            : 'Преподаватель не указан'}
                        </span>
                      </button>
                    ))}
                  </div>
                </StateWrapper>
              )}
            </div>
          ) : !selectedLetter ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Выберите букву класса
                  </span>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(e) => setIncludeArchived(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Показать архивные
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <Plus className="h-4 w-4" />
                  Создать класс
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {availableLetters.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setSelectedLetter(letter)}
                    className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-900"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Выберите номер класса на букву {selectedLetter}
                </span>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Показать архивные
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {numberOptions.map((number) => {
                  const classItem = classesByLetter[selectedLetter]?.find(
                    (item) => item.number === number,
                  )
                  if (!classItem) return null
                  return (
                    <button
                      key={classItem.id}
                      type="button"
                      onClick={() => handleSelectClass(classItem.id)}
                      className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-900"
                    >
                      {number}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </StateWrapper>
      {createModalOpen ? (
        <CreateClassModal
          onClose={() => setCreateModalOpen(false)}
          onSubmit={(params) =>
            createClassMutation.mutate(params, {
              onSuccess: () => setCreateModalOpen(false),
            })
          }
          isSubmitting={createClassMutation.isPending}
        />
      ) : null}
      {editModalClass ? (
        <EditClassModal
          classItem={editModalClass}
          onClose={() => setEditModalClass(null)}
          onSubmit={(params) =>
            patchClassMutation.mutate(
              { classId: editModalClass.id, params },
              {
                onSuccess: () => setEditModalClass(null),
              },
            )
          }
          isSubmitting={patchClassMutation.isPending}
        />
      ) : null}
    </div>
  )
}
