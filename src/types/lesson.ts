export type Grade = 2 | 3 | 4 | 5 | null

export type Attendance = 'present' | 'absent'

export type Lesson = {
  id: string
  subject: string
  classId: string
  className: string
  time: string
  room?: string
  topic?: string | null
  homeworkText?: string | null
}

export type LessonStudent = {
  studentId: string
  name: string
  attendance: Attendance
  grade: Grade
}

export type SubmitGradesPayload = {
  lessonId: string
  entries: Array<{
    studentId: string
    attendance: Attendance
    grade: Grade
  }>
  topic?: string | null
  homeworkText?: string | null
}
