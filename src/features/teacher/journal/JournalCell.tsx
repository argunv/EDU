import { type JournalGrade } from '../../../types/journal'
import { getGradeClass } from '../../../lib/gradeColors'

type JournalCellProps = {
  value: JournalGrade
  isActive: boolean
  isRowHovered: boolean
  isColHovered: boolean
  onOpen: () => void
  onClose: () => void
  draftValue: JournalGrade
  onDraftChange: (value: JournalGrade) => void
  onSave: () => void
  readOnly?: boolean
  hideNull?: boolean
  openUpwards?: boolean
}

const gradeOptions: JournalGrade[] = [null, 2, 3, 4, 5, 'Н']

export function JournalCell({
  value,
  isActive,
  isRowHovered,
  isColHovered,
  onOpen,
  onClose,
  draftValue,
  onDraftChange,
  onSave,
  readOnly = false,
  hideNull = false,
  openUpwards = false,
}: JournalCellProps) {
  const isEmptyString = typeof value === 'string' && value.trim() === ''
  const displayValue = value === null && hideNull ? '' : value == null || isEmptyString ? '—' : value
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center text-sm font-semibold ${
        isRowHovered || isColHovered ? 'bg-amber-100' : ''
      } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
      onClick={readOnly ? undefined : onOpen}
    >
      <span className={getGradeClass(value)}>{displayValue}</span>

      {isActive && !readOnly ? (
        <div
          className={`absolute left-1/2 z-20 w-36 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg ${
            openUpwards ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="grid grid-cols-3 gap-0.5">
            {gradeOptions.map((option) => (
              <button
                key={option ?? 'none'}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onDraftChange(option)
                }}
                className={`h-8 w-9 rounded-md border text-[11px] font-semibold ${
                  option === draftValue
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {option ?? '—'}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Отмена"
              onClick={(event) => {
                event.stopPropagation()
                onClose()
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-lg font-semibold text-rose-600"
            >
              ✕
            </button>
            <button
              type="button"
              aria-label="Сохранить"
              onClick={(event) => {
                event.stopPropagation()
                onSave()
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-lg font-semibold text-emerald-600"
            >
              ✓
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
