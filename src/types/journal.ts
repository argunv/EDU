export type JournalGrade = 2 | 3 | 4 | 5 | 'Н' | null

export type JournalStudent = {
  id: string
  name: string
}

export type JournalSubjectOption = {
  id: string
  name: string
}

export type JournalData = {
  classId: string
  className: string
  subject: string
  subjectId: string
  subjects: JournalSubjectOption[]
  dates: string[]
  students: JournalStudent[]
  grades: Record<string, Record<string, JournalGrade>>
}
