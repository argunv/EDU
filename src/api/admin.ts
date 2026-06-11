import { api } from './client'
import { getAdminClasses, type ClassItem } from './classes'
import {
  mapAdminClass,
  mapAdminScheduleSlot,
  mapAdminSubject,
  mapAdminSchoolSettings,
  type RawAdminClass,
  type RawAdminScheduleSlot,
  type RawAdminSubject,
  type AdminSubjectMapped,
} from './contracts'
import type {
  AdminScheduleChange,
  AdminScheduleSlot,
  AdminSchoolSettings,
  ShiftType,
} from '../types/adminSchedule'

export type AdminSubject = AdminSubjectMapped

export type AdminTeacherOption = { id: string; name: string }

export { getAdminClasses, type ClassItem }

export async function createAdminClass(params: {
  yearStart: number
  grade: number
  letter: string
  shift?: string | null
  shiftLocked?: boolean | null
  maxLessonsPerWeek?: number | null
}): Promise<ClassItem> {
  const { data } = await api.post<RawAdminClass>('/admin/classes', {
    year_start: params.yearStart,
    grade: params.grade,
    letter: params.letter.trim(),
    shift: params.shift ?? null,
    shift_locked: params.shiftLocked ?? null,
    max_lessons_per_week: params.maxLessonsPerWeek ?? null,
  })
  return mapAdminClass(data)
}

export async function patchAdminClass(
  classId: string,
  params: { shift?: string; shiftLocked?: boolean; maxLessonsPerWeek?: number | null }
): Promise<ClassItem> {
  const { data } = await api.patch<RawAdminClass>(`/admin/classes/${classId}`, {
    shift: params.shift,
    shift_locked: params.shiftLocked,
    max_lessons_per_week: params.maxLessonsPerWeek ?? null,
  })
  return mapAdminClass(data)
}

export async function archiveAdminClass(classId: string): Promise<void> {
  await api.post(`/admin/classes/${classId}/archive`)
}

export async function getAdminSubjects(): Promise<AdminSubject[]> {
  const { data } = await api.get<RawAdminSubject[]>('/admin/subjects')
  return data.map(mapAdminSubject)
}

export async function createAdminSubject(name: string): Promise<AdminSubject> {
  const { data } = await api.post<RawAdminSubject>('/admin/subjects', { name: name.trim() })
  return mapAdminSubject(data)
}

export async function deleteAdminSubject(subjectId: string): Promise<void> {
  await api.delete(`/admin/subjects/${subjectId}`)
}

export async function getAdminTeachers(subjectId?: string): Promise<AdminTeacherOption[]> {
  const params = subjectId ? { subject_id: subjectId } : {}
  const { data } = await api.get<Array<{ id: string; name: string }>>('/admin/teachers', { params })
  return data
}

export async function getAdminClassSubjects(classId: string): Promise<AdminSubject[]> {
  const { data } = await api.get<RawAdminSubject[]>(`/admin/classes/${classId}/subjects`)
  return data.map(mapAdminSubject)
}

export async function addAdminClassSubject(
  classId: string,
  subjectId: string,
  teacherId?: string | null
): Promise<AdminSubject> {
  const { data } = await api.post<RawAdminSubject>(`/admin/classes/${classId}/subjects`, {
    subject_id: subjectId,
    teacher_id: teacherId ?? null,
  })
  return mapAdminSubject(data)
}

export async function removeAdminClassSubject(classId: string, subjectId: string): Promise<void> {
  await api.delete(`/admin/classes/${classId}/subjects/${subjectId}`)
}

export async function getAdminJournal(
  classId: string,
  subjectId?: string,
  options?: { fromDate?: string; toDate?: string }
): Promise<{
  lessonMeta: { title: string; lastUpdated: string }
  dates: string[]
  students: Array<{
    id: string
    name: string
    grades: Array<2 | 3 | 4 | 5 | 'Н' | null>
    absences: number
  }>
}> {
  const params = new URLSearchParams({ class_id: classId })
  if (subjectId) params.set('subject_id', subjectId)
  if (options?.fromDate) params.set('from_date', options.fromDate)
  if (options?.toDate) params.set('to_date', options.toDate)
  const { data } = await api.get<{
    lesson_meta: { title: string; last_updated: string }
    dates: string[]
    students: Array<{ id: string; name: string; grades: (2 | 3 | 4 | 5 | 'Н' | null)[]; absences: number }>
  }>(`/admin/journal?${params}`)
  return {
    lessonMeta: {
      title: data.lesson_meta?.title ?? '',
      lastUpdated: data.lesson_meta?.last_updated ?? '',
    },
    dates: data.dates ?? [],
    students: data.students.map((s) => ({
      id: s.id,
      name: s.name,
      grades: s.grades ?? [],
      absences: s.absences ?? 0,
    })),
  }
}

export async function getAdminScheduleWeek(
  weekStartYmd: string,
  classId: string,
  shift: ShiftType
): Promise<AdminScheduleSlot[]> {
  const params = new URLSearchParams({
    week_start_iso: weekStartYmd,
    class_id: classId,
    shift,
  })
  const { data } = await api.get<RawAdminScheduleSlot[]>(`/admin/schedule?${params}`)
  return data.map((s) => mapAdminScheduleSlot(s) as AdminScheduleSlot)
}

export type BusyTeacherAtSlot = { teacher_name: string; class_name: string }

export async function getAdminScheduleBusyTeachers(
  shift: string,
  dayLabel: string,
  lessonNumber: number,
  excludeClassId: string
): Promise<BusyTeacherAtSlot[]> {
  const params = new URLSearchParams({
    shift,
    day_label: dayLabel,
    lesson_number: String(lessonNumber),
    exclude_class_id: excludeClassId,
  })
  const { data } = await api.get<BusyTeacherAtSlot[]>(`/admin/schedule/busy-teachers?${params}`)
  return data ?? []
}

export async function saveAdminScheduleChanges(changes: AdminScheduleChange[]): Promise<void> {
  const body = changes.map((c) => ({
    key: c.key,
    slot: c.slot
      ? {
          day_label: c.slot.dayLabel,
          lesson_number: c.slot.lessonNumber,
          time: c.slot.time,
          class_id: c.slot.classId,
          class_name: c.slot.className,
          shift: c.slot.shift,
          subject_id: c.slot.subjectId,
          subject_name: c.slot.subjectName,
          teacher_id: c.slot.teacherId,
          teacher_name: c.slot.teacherName,
          room: c.slot.room,
          note: c.slot.note,
          is_cancelled: c.slot.isCancelled,
        }
      : null,
  }))
  await api.post('/admin/schedule/changes', body)
}

export async function getAdminSchoolSettings(): Promise<AdminSchoolSettings> {
  const { data } = await api.get<{ is_two_shift?: boolean; class_shift_rules?: Record<string, string> }>(
    '/admin/school-settings'
  )
  return mapAdminSchoolSettings({
    is_two_shift: data?.is_two_shift ?? false,
    class_shift_rules: data?.class_shift_rules,
  })
}
