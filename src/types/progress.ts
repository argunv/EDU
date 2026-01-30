export type ProgressGrade = 0 | 1 | 2 | 3 | 4 | 5 | 'Н'

export type SubjectProgress = {
  subject: string
  teacherName: string
  grades: ProgressGrade[]
  gradeDates: string[]  // ISO date per grade, same order as grades
  absencesCount: number
}
