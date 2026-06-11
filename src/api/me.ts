import { api } from './client'
import type { HomeworkItem } from '../types/homework'
import type { SubjectProgress } from '../types/progress'
import type { ScheduleItem } from '../types/schedule'

export type ChildOption = { id: string; name: string; className: string }

export async function getMyChildren(): Promise<ChildOption[]> {
  const { data } = await api.get<Array<{ id: string; name: string; class_name: string }>>('/me/children')
  return data.map((c) => ({ id: c.id, name: c.name, className: c.class_name ?? '' }))
}

export async function getMySchedule(
  viewMode: 'day' | 'week',
  childId?: string,
  weekStartYmd?: string
): Promise<ScheduleItem[]> {
  const params: Record<string, string> = { view: viewMode }
  if (childId) params.child_id = childId
  if (viewMode === 'week' && weekStartYmd) params.week_start_iso = weekStartYmd
  const { data } = await api.get<Array<{
    id: string
    day_label: string
    lesson_number: number
    time: string
    subject: string
    teacher_name: string
    room?: string
    subject_id?: string
    grade?: string
  }>>('/me/schedule', { params })
  return data.map((s) => ({
    id: s.id,
    dayLabel: s.day_label,
    lessonNumber: s.lesson_number,
    time: s.time,
    subject: s.subject,
    teacherName: s.teacher_name,
    room: s.room,
    subjectId: s.subject_id,
    grade: s.grade,
  }))
}

export async function getMyHomework(
  range: 'today' | 'tomorrow' | 'week',
  childId?: string
): Promise<HomeworkItem[]> {
  const params: Record<string, string> = { range }
  if (childId) params.child_id = childId
  const { data } = await api.get<Array<{
    id: string
    due_date_label: string
    subject: string
    text: string
  }>>('/me/homework', { params })
  return data.map((h) => ({
    id: h.id,
    dueDateLabel: h.due_date_label ?? '',
    subject: h.subject,
    text: h.text,
  }))
}

function normalizeProgressGrades(raw: (number | string)[] | undefined): SubjectProgress['grades'] {
  if (!Array.isArray(raw)) return []
  return raw.map((g) => {
    if (g === 'Н' || g === null || g === undefined) return 'Н'
    if (typeof g === 'number' && g >= 0 && g <= 5) return g as 0 | 1 | 2 | 3 | 4 | 5
    const n = Number(g)
    if (!Number.isNaN(n) && n >= 0 && n <= 5) return Math.round(n) as 0 | 1 | 2 | 3 | 4 | 5
    return 'Н'
  })
}

export async function getMyProgress(
  childId?: string,
  yearStart?: number,
  semester?: 1 | 2
): Promise<SubjectProgress[]> {
  const params: Record<string, string | number> = {}
  if (childId) params.child_id = childId
  if (typeof yearStart === 'number') params.year_start = yearStart
  if (semester === 1 || semester === 2) params.semester = semester
  const { data } = await api.get<Array<{
    subject: string
    teacher_name: string
    grades: (number | string)[]
    grade_dates: string[]
    absences_count: number
  }>>('/me/progress', { params })
  return data.map((p) => ({
    subject: p.subject,
    teacherName: p.teacher_name ?? '',
    grades: normalizeProgressGrades(p.grades),
    gradeDates: p.grade_dates ?? [],
    absencesCount: p.absences_count ?? 0,
  }))
}
