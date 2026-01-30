export type ScheduleItem = {
  id: string
  dayLabel: string
  lessonNumber: number
  time: string
  subject: string
  teacherName: string
  room?: string
  subjectId?: string
  /** Оценка за этот предмет в этот день (2, 3, 4, 5, Н), если выставлена */
  grade?: string
}
