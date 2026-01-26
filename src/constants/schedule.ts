import type { WeekDayLabel } from '../types/adminSchedule'

export const WEEK_DAYS: WeekDayLabel[] = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
]

export const LESSON_SLOTS: Array<{ lessonNumber: number; time: string }> = [
  { lessonNumber: 1, time: '08:30' },
  { lessonNumber: 2, time: '09:25' },
  { lessonNumber: 3, time: '10:20' },
  { lessonNumber: 4, time: '11:30' },
  { lessonNumber: 5, time: '12:25' },
  { lessonNumber: 6, time: '13:20' },
  { lessonNumber: 7, time: '14:15' },
]
