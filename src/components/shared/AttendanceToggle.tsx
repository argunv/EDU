import { type Attendance } from '../../types/lesson'

type AttendanceToggleProps = {
  value: Attendance
  onChange: (value: Attendance) => void
}

export function AttendanceToggle({ value, onChange }: AttendanceToggleProps) {
  const isAbsent = value === 'absent'
  return (
    <button
      type="button"
      onClick={() => onChange(isAbsent ? 'present' : 'absent')}
      className={`h-12 w-12 rounded-lg border text-base font-semibold ${
        isAbsent
          ? 'border-rose-600 bg-rose-600 text-white'
          : 'border-emerald-600 bg-emerald-600 text-white'
      }`}
      aria-pressed={isAbsent}
    >
      Н
    </button>
  )
}
