import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getAdminClassSubjects,
  getAdminScheduleBusyTeachers,
} from '../../../api/admin'
import type {
  AdminScheduleSlot,
  AdminScheduleSlotDraft,
  ShiftType,
} from '../../../types/adminSchedule'
import type { ActiveCell } from './utils'

export type ScheduleEditModalProps = {
  open: boolean
  onClose: () => void
  onSave: (slot: AdminScheduleSlotDraft) => void
  onClear: () => void
  cell: ActiveCell | null
  slot: AdminScheduleSlot | null
  classes: Array<{ id: string; name: string }>
  lockedClassId?: string
  classLocked?: boolean
  currentShift: ShiftType
  editable: boolean
  findTeacherConflict: (teacherName: string, cell: ActiveCell) => string | null
}

export function ScheduleEditModal({
  open,
  onClose,
  onSave,
  onClear,
  cell,
  slot,
  classes,
  lockedClassId,
  classLocked = false,
  currentShift,
  editable,
  findTeacherConflict,
}: ScheduleEditModalProps) {
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)
  const [subjectSearch, setSubjectSearch] = useState('')
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const classChangeRef = useRef(false)

  const selectedClass = classes.find((item) => item.id === classId)

  const subjectsQuery = useQuery({
    queryKey: ['admin', 'subjects', classId],
    queryFn: () => getAdminClassSubjects(classId),
    enabled: Boolean(classId) && open,
  })

  const subjects = subjectsQuery.data ?? []
  const filteredSubjects =
    subjects.length > 10
      ? subjects.filter((item) =>
          item.name.toLowerCase().includes(subjectSearch.trim().toLowerCase()),
        )
      : subjects

  const subjectOptions =
    subjectId && filteredSubjects.every((item) => item.id !== subjectId)
      ? [...filteredSubjects, ...subjects.filter((item) => item.id === subjectId)]
      : filteredSubjects

  const selectedSubject = subjects.find((item) => item.id === subjectId)
  const teacherOptions = selectedSubject?.teachers ?? []

  const busyTeachersQuery = useQuery({
    queryKey: ['admin', 'schedule', 'busy-teachers', currentShift, cell?.dayLabel, cell?.lessonNumber, classId],
    queryFn: () =>
      getAdminScheduleBusyTeachers(currentShift, cell!.dayLabel, cell!.lessonNumber, classId),
    enabled: Boolean(open && cell && classId),
  })
  const busyTeachers = busyTeachersQuery.data ?? []

  useEffect(() => {
    if (!open || !cell) return
    setClassId(lockedClassId ?? slot?.classId ?? classes[0]?.id ?? '')
    setSubjectId(slot?.subjectId ?? '')
    setTeacherName(slot?.teacherName ?? '')
    setNote(slot?.note ?? '')
    setIsCancelled(Boolean(slot?.isCancelled))
    setSubjectSearch('')
    setShowNote(Boolean(slot?.note))
    setShowFieldErrors(false)
    classChangeRef.current = false
  }, [open, slot, classes, cell, lockedClassId])

  useEffect(() => {
    if (!open) return
    if (!classChangeRef.current) {
      classChangeRef.current = true
      return
    }
    setSubjectId('')
    setTeacherName('')
    setSubjectSearch('')
  }, [classId, open])

  useEffect(() => {
    if (subjects.length === 0) return
    if (!subjectId) {
      setSubjectId(subjects[0]?.id ?? '')
    }
  }, [subjects, subjectId])

  useEffect(() => {
    if (teacherOptions.length === 0) return
    if (!teacherName) {
      setTeacherName(teacherOptions[0] ?? '')
    } else if (!teacherOptions.includes(teacherName)) {
      setTeacherName(teacherOptions[0] ?? '')
    }
  }, [teacherOptions, teacherName])

  if (!open || !cell) return null

  const conflictSameClass = teacherName ? findTeacherConflict(teacherName, cell) : null
  const busyEntry = teacherName
    ? busyTeachers.find((b) => b.teacher_name === teacherName)
    : null
  const conflictOtherClass = busyEntry
    ? `Преподаватель уже ведёт урок в классе ${busyEntry.class_name} в это время.`
    : null
  const conflictWarning = conflictSameClass ?? conflictOtherClass ?? null
  const isValid = Boolean(classId && subjectId && teacherName) && !conflictWarning

  const handleSubmit = () => {
    if (!isValid || !selectedClass || !selectedSubject) {
      setShowFieldErrors(true)
      toast.error('Заполните обязательные поля')
      return
    }
    setShowFieldErrors(false)
    onSave({
      dayLabel: cell.dayLabel as AdminScheduleSlotDraft['dayLabel'],
      lessonNumber: cell.lessonNumber,
      time: cell.time,
      classId,
      className: selectedClass.name,
      shift: currentShift,
      subjectId,
      subjectName: selectedSubject.name,
      teacherName,
      note: note.trim() || undefined,
      isCancelled,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-edit-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div id="schedule-edit-title" className="text-lg font-semibold text-slate-900">
              Изменить урок
            </div>
            <div className="text-sm text-slate-600">
              {cell.dayLabel}, урок {cell.lessonNumber} · {cell.time}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          >
            Закрыть
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Класс</label>
            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value)
                setShowFieldErrors(false)
              }}
              disabled={!editable || classLocked}
              className={`mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm font-semibold text-slate-700 ${
                showFieldErrors && !classId ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'
              }`}
            >
              {classes.length > 0 ? (
                classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              ) : (
                <option value="">Нет классов</option>
              )}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Предмет</label>
            {subjects.length > 10 ? (
              <input
                value={subjectSearch}
                onChange={(event) => setSubjectSearch(event.target.value)}
                placeholder="Найти предмет"
                className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              />
            ) : null}
            <select
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value)
                setShowFieldErrors(false)
              }}
              disabled={!editable || subjectsQuery.isLoading}
              className={`mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm font-semibold text-slate-700 ${
                showFieldErrors && !subjectId ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'
              }`}
            >
              {subjectsQuery.isLoading ? (
                <option value="">Загрузка...</option>
              ) : subjectOptions.length > 0 ? (
                subjectOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              ) : (
                <option value="">Нет предметов</option>
              )}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Преподаватель</label>
            <select
              value={teacherName}
              onChange={(event) => {
                setTeacherName(event.target.value)
                setShowFieldErrors(false)
              }}
              disabled={!editable || teacherOptions.length === 0}
              className={`mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm font-semibold text-slate-700 ${
                showFieldErrors && !teacherName ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'
              }`}
            >
              {teacherOptions.length > 0 ? (
                teacherOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))
              ) : (
                <option value="">Нет преподавателей</option>
              )}
            </select>
            {conflictWarning ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {conflictWarning}
              </div>
            ) : null}
          </div>

          <div>
            {!showNote ? (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                disabled={!editable}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                + Добавить комментарий
              </button>
            ) : null}
            {showNote ? (
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Например: кабинет 308, лабораторная работа, перенос урока"
                  disabled={!editable}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNote('')
                    setShowNote(false)
                  }}
                  disabled={!editable}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  Удалить комментарий
                </button>
              </div>
            ) : null}
          </div>

          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={isCancelled}
              onChange={(event) => setIsCancelled(event.target.checked)}
              disabled={!editable}
              className="size-5 rounded border-slate-300"
            />
            Отмена урока
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!editable || !isValid}
              className="h-11 flex-1 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => {
                if (!editable) return
                const confirmed = window.confirm(
                  'Очистить слот? Урок будет удалён из расписания.',
                )
                if (confirmed) {
                  onClear()
                }
              }}
              disabled={!editable}
              className="h-11 flex-1 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 disabled:opacity-40"
            >
              Очистить слот
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
