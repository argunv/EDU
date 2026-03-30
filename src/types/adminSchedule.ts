export type WeekDayLabel =
  | 'Понедельник'
  | 'Вторник'
  | 'Среда'
  | 'Четверг'
  | 'Пятница'
  | 'Суббота'

export type ShiftType = 'morning' | 'evening'

export type AdminScheduleSlot = {
  id: string
  dayLabel: WeekDayLabel
  lessonNumber: number
  time: string
  classId: string
  className: string
  shift: ShiftType
  subjectId: string
  subjectName: string
  teacherId?: string
  teacherName: string
  room?: string
  note?: string
  isCancelled?: boolean
}

export type AdminScheduleSlotDraft = {
  dayLabel: WeekDayLabel
  lessonNumber: number
  time: string
  classId: string
  className: string
  shift: ShiftType
  subjectId: string
  subjectName: string
  teacherId?: string
  teacherName: string
  room?: string
  note?: string
  isCancelled?: boolean
}

export type AdminScheduleChange = {
  key: string
  slot: AdminScheduleSlotDraft | null
}

export type AdminSchoolSettings = {
  isTwoShift: boolean
  classShiftRules?: Record<string, ShiftType>
}
