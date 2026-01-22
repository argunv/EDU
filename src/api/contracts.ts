/**
 * Централизованный контракт API: сырые типы ответов бэкенда (snake_case) и маппинг в типы фронта (camelCase).
 * При добавлении полей на бэкенде обновить соответствующий Raw-тип и маппер здесь.
 */
import type { ShiftType } from '../types/adminSchedule'

// ----- Admin Classes -----

export type RawAdminClass = {
  id: string
  name: string
  year_start: number
  grade: number
  letter: string
  shift?: string
  shift_locked?: boolean
  max_lessons_per_week?: number | null
  archived: boolean
}

export type AdminClassMapped = {
  id: string
  name: string
  yearStart: number
  grade: number
  letter: string
  shift?: ShiftType
  shiftLocked?: boolean
  maxLessonsPerWeek?: number
  archived: boolean
}

export function mapAdminClass(raw: RawAdminClass): AdminClassMapped {
  return {
    id: raw.id,
    name: raw.name,
    yearStart: raw.year_start,
    grade: raw.grade,
    letter: raw.letter,
    shift: raw.shift as ShiftType | undefined,
    shiftLocked: raw.shift_locked,
    maxLessonsPerWeek: raw.max_lessons_per_week ?? undefined,
    archived: raw.archived,
  }
}

// ----- Admin Schedule Slot -----

export type RawAdminScheduleSlot = {
  id: string
  day_label: string
  lesson_number: number
  time: string
  class_id: string
  class_name: string
  shift: string
  subject_id: string
  subject_name: string
  teacher_name: string
  room?: string | null
  note?: string | null
  is_cancelled?: boolean | null
}

export type AdminScheduleSlotMapped = {
  id: string
  dayLabel: string
  lessonNumber: number
  time: string
  classId: string
  className: string
  shift: ShiftType
  subjectId: string
  subjectName: string
  teacherName: string
  room?: string | null
  note?: string | null
  isCancelled?: boolean | null
}

export function mapAdminScheduleSlot(raw: RawAdminScheduleSlot): AdminScheduleSlotMapped {
  return {
    id: raw.id,
    dayLabel: raw.day_label,
    lessonNumber: raw.lesson_number,
    time: raw.time,
    classId: raw.class_id,
    className: raw.class_name,
    shift: raw.shift as ShiftType,
    subjectId: raw.subject_id,
    subjectName: raw.subject_name,
    teacherName: raw.teacher_name,
    room: raw.room ?? undefined,
    note: raw.note ?? undefined,
    isCancelled: raw.is_cancelled ?? undefined,
  }
}

// ----- Admin Subject -----

export type RawAdminSubject = {
  id: string
  name: string
  teachers: string[]
  teacher_id?: string | null
  teacher_name?: string | null
}

export type AdminSubjectMapped = {
  id: string
  name: string
  teachers: string[]
  teacherId?: string | null
  teacherName?: string | null
}

export function mapAdminSubject(raw: RawAdminSubject): AdminSubjectMapped {
  return {
    id: raw.id,
    name: raw.name,
    teachers: raw.teachers ?? [],
    teacherId: raw.teacher_id ?? null,
    teacherName: raw.teacher_name ?? null,
  }
}

// ----- School Settings -----

export type RawAdminSchoolSettings = {
  is_two_shift: boolean
  class_shift_rules?: Record<string, string>
}

export type AdminSchoolSettingsMapped = {
  isTwoShift: boolean
  classShiftRules?: Record<string, ShiftType>
}

export function mapAdminSchoolSettings(raw: RawAdminSchoolSettings): AdminSchoolSettingsMapped {
  return {
    isTwoShift: raw.is_two_shift,
    classShiftRules: raw.class_shift_rules as Record<string, ShiftType> | undefined,
  }
}
