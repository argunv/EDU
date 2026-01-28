import { Link } from 'react-router-dom'

import { type Lesson } from '../../types/lesson'

type LessonCardProps = {
  lesson: Lesson
  dayIndex?: number
  weekOffset?: number
  lessonNumber?: number
}

export function LessonCard({ lesson, dayIndex, weekOffset, lessonNumber }: LessonCardProps) {
  const hasDay = typeof dayIndex === 'number'
  const hasWeek = typeof weekOffset === 'number'
  const query = new URLSearchParams()
  if (hasDay) query.set('dayIndex', String(dayIndex))
  if (hasWeek) query.set('weekOffset', String(weekOffset))
  const queryString = query.toString()
  const timeRange = lesson.time.includes('–')
    ? lesson.time
    : `${lesson.time}–${addMinutes(lesson.time, 45)}`
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
      <Link
        to={`/teacher/lesson/${lesson.id}${queryString ? `?${queryString}` : ''}`}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between text-lg font-semibold text-slate-900 dark:text-slate-100">
          <span>{timeRange}</span>
          {lessonNumber ? (
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Урок {lessonNumber}
            </span>
          ) : null}
        </div>
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Класс {lesson.className}</div>
        <div className="text-base text-slate-700 dark:text-slate-300">{lesson.subject}</div>
      </Link>
      <Link
        to={`/teacher/journal/${lesson.classId}`}
        className="mt-1 flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-base font-semibold text-white dark:bg-white dark:text-black"
      >
        Журнал
      </Link>
    </div>
  )
}

function addMinutes(time: string, minutesToAdd: number) {
  const [hours, minutes] = time.split(':').map((value) => Number(value))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time
  const total = hours * 60 + minutes + minutesToAdd
  const nextHours = Math.floor(total / 60) % 24
  const nextMinutes = total % 60
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`
}
