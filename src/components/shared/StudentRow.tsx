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
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 text-base font-semibold text-slate-900">{name}</div>
      <div className="grid grid-cols-[repeat(6,3rem)_minmax(0,1fr)] items-center gap-1">
        {gradeOptions.map((option) => {
          const isActive = grade === option
          return (
            <button
              key={option ?? 'none'}
              type="button"
              onClick={() => onGradeChange(option)}
              className={`h-12 w-12 rounded-lg border text-base font-semibold ${
                isActive
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              {option ?? '—'}
            </button>
          )
        })}
        <AttendanceToggle value={attendance} onChange={onAttendanceChange} />
        <input
          type="text"
          placeholder="Комментарий"
          className="h-12 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-900"
        />
      </div>
    </div>
  )
}
