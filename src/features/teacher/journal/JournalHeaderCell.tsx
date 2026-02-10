import { forwardRef } from 'react'

const DATE_COLUMN_WIDTH_PX = 56

type JournalHeaderCellProps = {
  day: string
  monthLabel?: string
  /** Когда true, колонка тянется по ширине (мало дат); иначе фиксированная 56px */
  flexible?: boolean
}

export const JournalHeaderCell = forwardRef<HTMLTableCellElement, JournalHeaderCellProps>(
  function JournalHeaderCell({ day, monthLabel, flexible = false }, ref) {
    return (
      <th
        ref={ref}
        className="h-12 border-b border-r border-slate-200 bg-white px-1 py-1 text-center text-xs font-semibold text-slate-700"
        style={
          flexible
            ? { minWidth: DATE_COLUMN_WIDTH_PX }
            : {
                width: DATE_COLUMN_WIDTH_PX,
                minWidth: DATE_COLUMN_WIDTH_PX,
                maxWidth: DATE_COLUMN_WIDTH_PX,
              }
        }
      >
      <div className="text-base font-semibold text-slate-900">{day}</div>
      {monthLabel ? (
        <div className="text-[10px] font-bold text-slate-500">{monthLabel}</div>
      ) : null}
    </th>
    )
  }
)
