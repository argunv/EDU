import { WEEK_DAYS } from '../../../constants/schedule'
import { LESSON_SLOTS } from '../../../constants/schedule'
import type {
  AdminScheduleSlot,
  AdminScheduleSlotDraft,
  WeekDayLabel,
  ShiftType,
} from '../../../types/adminSchedule'

export type SlotKey = string

export type ActiveCell = {
  dayLabel: string
  lessonNumber: number
  time: string
}

const DAY_LABEL_EN = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABEL_RU: WeekDayLabel[] = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

export function getWeekStart(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(date)
  start.setDate(date.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

export function makeSlotKey(dayLabel: string, lessonNumber: number): SlotKey {
  return `${dayLabel}-${lessonNumber}`
}

export function makeChangeKey(
  dayLabel: string,
  lessonNumber: number,
  classId: string,
  shift: ShiftType,
): string {
  return `${classId}-${shift}-${dayLabel}-${lessonNumber}`
}

export function normalizeDayLabel(dayLabel: string): WeekDayLabel {
  const lower = dayLabel.trim().toLowerCase()
  const enIndex = DAY_LABEL_EN.findIndex((d) => d === lower)
  if (enIndex >= 0 && enIndex < DAY_LABEL_RU.length) return DAY_LABEL_RU[enIndex]
  if (WEEK_DAYS.includes(dayLabel as WeekDayLabel)) return dayLabel as WeekDayLabel
  return DAY_LABEL_RU[0]
}

export function buildGridMap(
  items: AdminScheduleSlot[],
  slots: Array<{ lessonNumber: number }>,
): Record<SlotKey, AdminScheduleSlot | null> {
  const map: Record<SlotKey, AdminScheduleSlot | null> = {}
  WEEK_DAYS.forEach((day) => {
    slots.forEach((slot) => {
      map[makeSlotKey(day, slot.lessonNumber)] = null
    })
  })
  items.forEach((item) => {
    const day = normalizeDayLabel(item.dayLabel)
    map[makeSlotKey(day, item.lessonNumber)] = { ...item, dayLabel: day }
  })
  return map
}

export function buildLessonSlots(data: AdminScheduleSlot[] | undefined): Array<{ lessonNumber: number; time: string }> {
  const maxLesson = data?.reduce((max, item) => Math.max(max, item.lessonNumber), 0) ?? 0
  const slotsCount = maxLesson > 0 ? Math.min(7, maxLesson) : Math.min(7, LESSON_SLOTS.length)
  return LESSON_SLOTS.slice(0, slotsCount)
}

export function getLessonCount(data: AdminScheduleSlot[] | undefined): number {
  return buildLessonSlots(data).length
}

export function isSameSlot(a: AdminScheduleSlotDraft | null, b: AdminScheduleSlot | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    a.classId === b.classId &&
    a.shift === b.shift &&
    a.subjectId === b.subjectId &&
    a.teacherName === b.teacherName &&
    (a.room ?? '') === (b.room ?? '') &&
    (a.note ?? '') === (b.note ?? '') &&
    Boolean(a.isCancelled) === Boolean(b.isCancelled)
  )
}

export { WEEK_DAYS, LESSON_SLOTS }
