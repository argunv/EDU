import { AttendanceToggle } from './AttendanceToggle'
import { type Attendance, type Grade } from '../../types/lesson'

type StudentRowProps = {
  name: string
  attendance: Attendance
  grade: Grade
  onAttendanceChange: (value: Attendance) => void
  onGradeChange: (value: Grade) => void
}

const gradeOptions: Grade[] = [null, 2, 3, 4, 5]

export function StudentRow({
  name,
  attendance,
  grade,
  onAttendanceChange,
  onGradeChange,
}: StudentRowProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 text-base font-semibold text-foreground">{name}</div>
      <div className="grid grid-cols-6 items-center gap-1">
        {gradeOptions.map((option) => {
          const isActive = grade === option
          return (
            <button
              key={option ?? 'none'}
              type="button"
              onClick={() => onGradeChange(option)}
              aria-label={option === null ? 'Без оценки' : `Оценка ${option}`}
              aria-pressed={isActive}
              className={`h-12 w-12 rounded-lg border text-base font-semibold ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              {option ?? '—'}
            </button>
          )
        })}
        <AttendanceToggle value={attendance} onChange={onAttendanceChange} />
      </div>
    </div>
  )
}
