import { api } from './client'
import type { Lesson, LessonStudent, SubmitGradesPayload } from '../types/lesson'

export async function getTeacherLessons(params: {
  weekOffset: number
  dayIndex: number
}): Promise<Lesson[]> {
  const { data } = await api.get<Array<{
    id: string
    subject: string
    class_id: string
    class_name: string
    time: string
    room?: string
    topic?: string | null
    homework_text?: string | null
  }>>('/teacher/lessons', { params: { week_offset: params.weekOffset, day_index: params.dayIndex } })
  return data.map((l) => ({
    id: l.id,
    subject: l.subject,
    classId: l.class_id,
    className: l.class_name,
    time: l.time,
    room: l.room,
    topic: l.topic ?? null,
    homeworkText: l.homework_text ?? null,
  }))
}

export async function getLessonStudents(lessonId: string): Promise<LessonStudent[]> {
  if (!lessonId) return []
  const { data } = await api.get<Array<{
    student_id: string
    name: string
    attendance: string
    grade: number | null
  }>>(`/teacher/lessons/${lessonId}/students`)
  return data.map((s) => ({
    studentId: s.student_id,
    name: s.name,
    attendance: s.attendance as 'present' | 'absent',
    grade: s.grade as LessonStudent['grade'],
  }))
}

export async function submitGrades(payload: SubmitGradesPayload): Promise<{ success: true }> {
  await api.post('/teacher/lessons/grades', {
    lesson_id: payload.lessonId,
    entries: payload.entries.map((e) => ({
      student_id: e.studentId,
      attendance: e.attendance,
      grade: e.grade,
    })),
    topic: payload.topic ?? null,
    homework_text: payload.homeworkText ?? null,
  })
  return { success: true }
}
