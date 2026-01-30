import { api } from './client'
import type { JournalData, JournalGrade } from '../types/journal'

export async function getTeacherJournal(params: {
  classId?: string
  subjectId?: string
  fromDate?: string
  toDate?: string
}): Promise<JournalData> {
  const query: Record<string, string> = {}
  if (params.classId) query.class_id = params.classId
  if (params.subjectId) query.subject_id = params.subjectId
  if (params.fromDate) query.from_date = params.fromDate
  if (params.toDate) query.to_date = params.toDate
  const { data } = await api.get<{
    class_id: string
    class_name: string
    subject: string
    subject_id: string
    subjects: Array<{ id: string; name: string }>
    dates: string[]
    students: Array<{ id: string; name: string }>
    grades: Record<string, Record<string, number | string | null>>
  }>('/teacher/journal', { params: query })
  return {
    classId: data.class_id,
    className: data.class_name,
    subject: data.subject,
    subjectId: data.subject_id,
    subjects: data.subjects ?? [],
    dates: data.dates,
    students: data.students,
    grades: data.grades as JournalData['grades'],
  }
}

export async function saveTeacherGrade(params: {
  classId: string
  subjectId: string
  studentId: string
  dateISO: string
  value: JournalGrade
}): Promise<{ success: true }> {
  await api.post('/teacher/journal/grade', {
    class_id: params.classId,
    subject_id: params.subjectId,
    student_id: params.studentId,
    date_iso: params.dateISO,
    value: params.value,
  })
  return { success: true }
}
