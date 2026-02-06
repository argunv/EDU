import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  getAdminClasses,
  getAdminSchoolSettings,
  getAdminScheduleWeek,
  saveAdminScheduleChanges,
} from '../../api/admin'
import { OrientationNotice } from '../../components/shared/OrientationNotice'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { useAuth } from '../auth/useAuth'
import type {
  AdminScheduleSlot,
  AdminScheduleSlotDraft,
  ShiftType,
} from '../../types/adminSchedule'
import {
  type ActiveCell,
  type SlotKey,
  buildGridMap,
  getLessonCount,
  getWeekStart,
  makeChangeKey,
  makeSlotKey,
  WEEK_DAYS,
} from './schedule/utils'
import { LESSON_SLOTS } from '../../constants/schedule'
import { ScheduleGridDesktop } from './schedule/ScheduleGridDesktop'
import { ScheduleGridMobile } from './schedule/ScheduleGridMobile'
import { ScheduleEditModal } from './schedule/ScheduleEditModal'
import { ScheduleSaveBar } from './schedule/ScheduleSaveBar'
import { isSameSlot } from './schedule/utils'

const MOBILE_BREAKPOINT = 768

export function AdminSchedulePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [weekOffset] = useState(0)
  const [showOrientationNotice, setShowOrientationNotice] = useState(false)
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [originalByKey, setOriginalByKey] = useState<Record<SlotKey, AdminScheduleSlot | null>>({})
  const [currentByKey, setCurrentByKey] = useState<Record<SlotKey, AdminScheduleSlot | null>>({})
  const [dirtyKeys, setDirtyKeys] = useState<Record<SlotKey, boolean>>({})
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedShift, setSelectedShift] = useState<ShiftType>('morning')
  const [initialShift, setInitialShift] = useState<ShiftType>('morning')
  const [lessonCount, setLessonCount] = useState(LESSON_SLOTS.length)

  const weekStart = useMemo(() => {
    const base = getWeekStart(new Date())
    base.setDate(base.getDate() + weekOffset * 7)
    return base
  }, [weekOffset])

  const classesQuery = useQuery({
    queryKey: ['admin', 'classes'],
    queryFn: () => getAdminClasses(),
    enabled: isAdmin,
  })

  const settingsQuery = useQuery({
    queryKey: ['admin', 'school-settings'],
    queryFn: getAdminSchoolSettings,
    enabled: isAdmin,
  })

  const classes = classesQuery.data ?? []
  const schoolSettings = settingsQuery.data
  const isTwoShift = false

  const classIdParam = searchParams.get('classId')
  const shiftParam = searchParams.get('shift')
  const normalizedShift =
    shiftParam === 'morning' || shiftParam === 'evening' ? (shiftParam as ShiftType) : null

  const selectedClass = classes.find((item) => item.id === selectedClassId)
  const isShiftLocked = Boolean(selectedClass?.shiftLocked)

  const resolveDefaultShift = (classId: string) => {
    const classItem = classes.find((item) => item.id === classId)
    return classItem?.shift ?? schoolSettings?.classShiftRules?.[classId] ?? null
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'schedule', 'week', weekStart.toISOString(), selectedClassId, selectedShift],
    queryFn: () => getAdminScheduleWeek(weekStart.toISOString(), selectedClassId, selectedShift),
    enabled: isAdmin && Boolean(selectedClassId),
  })

  useEffect(() => {
    if (!classes.length) return
    if (!classIdParam || !classes.some((item) => item.id === classIdParam)) {
      navigate('/admin/classes', { replace: true })
      return
    }
    const validClassId = classIdParam
    const defaultShift = resolveDefaultShift(validClassId) ?? 'morning'
    const shiftToSet = isTwoShift ? (normalizedShift ?? defaultShift) : 'morning'
    setSelectedClassId(validClassId)
    setSelectedShift(shiftToSet)
    if (validClassId !== selectedClassId) {
      setInitialShift(shiftToSet)
    }

    const nextParams = new URLSearchParams(searchParams)
    let changed = false
    if (nextParams.get('classId') !== validClassId) {
      nextParams.set('classId', validClassId)
      changed = true
    }
    if (isTwoShift) {
      if (nextParams.get('shift') !== shiftToSet) {
        nextParams.set('shift', shiftToSet)
        changed = true
      }
    } else if (nextParams.has('shift')) {
      nextParams.delete('shift')
      changed = true
    }
    if (changed) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [classes, classIdParam, normalizedShift, isTwoShift, searchParams, setSearchParams, navigate, selectedClassId])

  useEffect(() => {
    if (!selectedClassId) return
    if (Object.keys(dirtyKeys).length > 0) return
    const fromData = data ? getLessonCount(data) : 0
    const fromClass = selectedClass?.maxLessonsPerWeek
    const effectiveCount = Math.min(
      7,
      Math.max(1, Math.max(fromData, fromClass ?? 0) || LESSON_SLOTS.length),
    )
    setLessonCount(effectiveCount)
    const slots = LESSON_SLOTS.slice(0, effectiveCount)
    const map = data ? buildGridMap(data, slots) : buildGridMap([], slots)
    setOriginalByKey(map)
    setCurrentByKey(map)
  }, [data, selectedClassId, selectedClass?.maxLessonsPerWeek])

  useEffect(() => {
    const updateOrientationState = () => {
      const dismissed = sessionStorage.getItem('admin-schedule-orientation-dismissed') === '1'
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      const portrait = window.matchMedia('(orientation: portrait)').matches
      setShowOrientationNotice(mobile && portrait && !dismissed)
    }

    updateOrientationState()
    const mediaQuery = window.matchMedia('(orientation: portrait)')
    window.addEventListener('resize', updateOrientationState)
    mediaQuery.addEventListener('change', updateOrientationState)

    return () => {
      window.removeEventListener('resize', updateOrientationState)
      mediaQuery.removeEventListener('change', updateOrientationState)
    }
  }, [])

  const handleDismissNotice = () => {
    sessionStorage.setItem('admin-schedule-orientation-dismissed', '1')
    setShowOrientationNotice(false)
  }

  const handleApplySlot = (cell: ActiveCell, slot: AdminScheduleSlotDraft | null) => {
    const key = makeSlotKey(cell.dayLabel, cell.lessonNumber)
    setCurrentByKey((prev) => ({ ...prev, [key]: slot ? { id: key, ...slot } : null }))
    setDirtyKeys((prev) => {
      const original = originalByKey[key] ?? null
      const changed = !isSameSlot(slot, original)
      if (!changed && prev[key]) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      if (changed) {
        return { ...prev, [key]: true }
      }
      return prev
    })
  }

  const shiftChanged =
    isTwoShift && !isShiftLocked && selectedShift !== initialShift
  const hasChanges =
    Object.keys(dirtyKeys).length > 0 || shiftChanged

  const changeCount =
    Object.keys(dirtyKeys).length + (shiftChanged ? 1 : 0)

  const handleSaveChanges = async () => {
    if (!hasChanges) return
    const changes = Object.keys(dirtyKeys).map((key) => {
      const lastDash = key.lastIndexOf('-')
      const dayLabel = lastDash >= 0 ? key.slice(0, lastDash) : key
      const lessonNumber = Number(key.slice(lastDash + 1))
      return {
        key: makeChangeKey(dayLabel, Number.isNaN(lessonNumber) ? 1 : lessonNumber, selectedClassId, selectedShift),
        slot: currentByKey[key] ?? null,
      }
    })
    try {
      if (changes.length > 0) {
        await saveAdminScheduleChanges(changes)
        setOriginalByKey(currentByKey)
        setDirtyKeys({})
        await queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] })
        await queryClient.invalidateQueries({ queryKey: ['admin', 'schedule'] })
      }
      if (shiftChanged) {
        setInitialShift(selectedShift)
      }
      toast.success('Изменения сохранены')
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null
      toast.error(typeof message === 'string' ? message : 'Не удалось сохранить изменения')
    }
  }

  const handleResetChanges = () => {
    setCurrentByKey(originalByKey)
    setDirtyKeys({})
    if (shiftChanged) {
      setSelectedShift(initialShift)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('shift', initialShift)
      setSearchParams(nextParams, { replace: true })
    }
    toast.message('Изменения отменены')
  }

  const setMaxLessonsPerWeek = (newCount: number) => {
    const clamped = Math.min(7, Math.max(1, newCount))
    if (clamped === lessonCount) return
    if (clamped < lessonCount) {
      setLessonCount(clamped)
      setCurrentByKey((prev) => {
        const next = { ...prev }
        WEEK_DAYS.forEach((day) => {
          for (let num = clamped + 1; num <= lessonCount; num++) {
            next[makeSlotKey(day, num)] = null
          }
        })
        return next
      })
      setDirtyKeys((prev) => {
        const next = { ...prev }
        WEEK_DAYS.forEach((day) => {
          for (let num = clamped + 1; num <= lessonCount; num++) {
            next[makeSlotKey(day, num)] = true
          }
        })
        return next
      })
    } else {
      setLessonCount(clamped)
      setCurrentByKey((prev) => {
        const next = { ...prev }
        for (let num = lessonCount + 1; num <= clamped; num++) {
          WEEK_DAYS.forEach((day) => {
            next[makeSlotKey(day, num)] = null
          })
        }
        return next
      })
      setDirtyKeys((prev) => {
        const next = { ...prev }
        for (let num = lessonCount + 1; num <= clamped; num++) {
          WEEK_DAYS.forEach((day) => {
            next[makeSlotKey(day, num)] = true
          })
        }
        return next
      })
    }
  }

  const lessonSlots = useMemo(() => {
    const safeCount = Math.min(7, Math.max(1, lessonCount))
    return LESSON_SLOTS.slice(0, safeCount)
  }, [lessonCount])

  const header = (
    <header className="flex min-h-[56px] items-center justify-center border-b border-slate-200 bg-white px-4 py-4 dark:border-zinc-600 dark:bg-zinc-900">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        Расписание{selectedClass?.name ? ` · ${selectedClass.name}` : ''}
      </h1>
    </header>
  )

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 text-sm text-slate-600">
        Страница расписания доступна только администратору.
      </div>
    )
  }

  const isPageLoading = classesQuery.isLoading || settingsQuery.isLoading || isLoading
  const isPageError = classesQuery.isError || settingsQuery.isError || isError
  const hasClasses = classes.length > 0
  const isPageEmpty = !isPageLoading && !isPageError && !hasClasses
  const emptyTitle = 'Нет классов'
  const emptyDescription = 'Добавьте классы, чтобы настроить расписание.'
  const handleRefetch = () => {
    refetch()
    classesQuery.refetch()
    settingsQuery.refetch()
  }

  return (
    <div className={`relative ${showOrientationNotice ? 'pt-16' : ''}`}>
      <OrientationNotice
        visible={showOrientationNotice}
        onDismiss={handleDismissNotice}
        message="Для удобства редактирования расписания переверните устройство горизонтально"
      />
      <div className="sticky top-0 z-30">{header}</div>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
        <StateWrapper
          isLoading={isPageLoading}
          isError={isPageError}
          isEmpty={isPageEmpty}
          onRetry={handleRefetch}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        >
          <div className="flex flex-col gap-4">
            <div className="text-sm text-slate-600">
              Нажмите на ячейку, чтобы назначить или изменить урок.
            </div>

            <div className="hidden md:block">
              <ScheduleGridDesktop
                lessonSlots={lessonSlots}
                currentByKey={currentByKey}
                dirtyKeys={dirtyKeys}
                lessonCount={lessonCount}
                onCellClick={setActiveCell}
                onLessonCountDecrease={() => setMaxLessonsPerWeek(lessonCount - 1)}
                onLessonCountIncrease={() => setMaxLessonsPerWeek(lessonCount + 1)}
              />
            </div>

            <ScheduleGridMobile
              lessonSlots={lessonSlots}
              currentByKey={currentByKey}
              dirtyKeys={dirtyKeys}
              lessonCount={lessonCount}
              onCellClick={setActiveCell}
              onLessonCountDecrease={() => setMaxLessonsPerWeek(lessonCount - 1)}
              onLessonCountIncrease={() => setMaxLessonsPerWeek(lessonCount + 1)}
            />
          </div>
        </StateWrapper>
      </div>

      <ScheduleEditModal
        open={Boolean(activeCell)}
        onClose={() => setActiveCell(null)}
        cell={activeCell}
        slot={activeCell ? currentByKey[makeSlotKey(activeCell.dayLabel, activeCell.lessonNumber)] : null}
        classes={classes}
        lockedClassId={selectedClassId}
        classLocked
        currentShift={selectedShift}
        onSave={(slot) => {
          if (!activeCell) return
          handleApplySlot(activeCell, slot)
          setActiveCell(null)
        }}
        onClear={() => {
          if (!activeCell) return
          handleApplySlot(activeCell, null)
          setActiveCell(null)
        }}
        editable
        findTeacherConflict={(teacherName, cell) => {
          const key = makeSlotKey(cell.dayLabel, cell.lessonNumber)
          const hasConflict = Object.entries(currentByKey).some(([slotKey, slot]) => {
            if (!slot || slotKey === key) return false
            return (
              slot.teacherName === teacherName &&
              slot.dayLabel === cell.dayLabel &&
              slot.lessonNumber === cell.lessonNumber
            )
          })
          return hasConflict ? 'Возможный конфликт: преподаватель уже занят в это время.' : null
        }}
      />

      {hasChanges ? (
        <ScheduleSaveBar
          changeCount={changeCount}
          onSave={handleSaveChanges}
          onReset={handleResetChanges}
        />
      ) : null}
    </div>
  )
}
