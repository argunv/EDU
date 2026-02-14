import { getGradeClass } from '../../../lib/gradeColors'
import type { JournalGrade } from '../../../types/journal'
import { type ScheduleItem } from '../../../types/schedule'

type LessonRowProps = {
  item: ScheduleItem
  showRoom?: boolean
}

function toJournalGrade(grade: string): JournalGrade {
  if (grade === 'Н') return 'Н'
  const n = Number(grade)
  if (n === 2 || n === 3 || n === 4 || n === 5) return n
  return null
}

export function LessonRow({ item, showRoom = false }: LessonRowProps) {
  const timeRange = item.time.includes('–') ? item.time : `${item.time}–${addMinutes(item.time, 45)}`
  const gradeForClass = item.grade != null && item.grade !== '' ? toJournalGrade(item.grade) : null

  return (
    <div className="flex min-h-11 items-center gap-4 py-3">
      <div className="w-24 shrink-0 text-sm font-semibold text-foreground">
        {timeRange}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold text-foreground">{item.subject}</div>
        <div className="text-sm text-muted-foreground">{item.teacherName}</div>
        {showRoom && item.room ? (
          <div className="text-xs text-muted-foreground">Каб. {item.room}</div>
        ) : null}
      </div>
      {gradeForClass != null ? (
        <div
          className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-base font-bold ${getGradeClass(gradeForClass)}`}
          aria-label={`Оценка: ${item.grade}`}
        >
          {item.grade}
        </div>
      ) : null}
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
