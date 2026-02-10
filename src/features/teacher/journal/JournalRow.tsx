import { JournalAverageCell } from './JournalAverageCell'
import { JournalCell } from './JournalCell'
import { type JournalGrade } from '../../../types/journal'

type JournalRowProps = {
  index: number
  studentId: string
  name: string
  dates: string[]
  grades: Record<string, JournalGrade>
  activeCell: { studentId: string; date: string } | null
  hoveredRowId: string | null
  hoveredColIndex: number | null
  onCellOpen: (studentId: string, date: string) => void
  onCellClose: () => void
  draftValue: JournalGrade
  onDraftChange: (value: JournalGrade) => void
  onSave: (studentId: string, date: string, value: JournalGrade) => void
}

export function JournalRow({
  index,
  studentId,
  name,
  dates,
  grades,
  activeCell,
  hoveredRowId,
  hoveredColIndex,
  onCellOpen,
  onCellClose,
  draftValue,
  onDraftChange,
  onSave,
}: JournalRowProps) {
  const rowBg = index % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'

  return (
    <tr className={rowBg}>
      <th className="sticky left-0 z-10 w-64 border-r border-slate-200 bg-inherit px-3 py-2 text-left text-sm font-semibold text-slate-900">
        {name}
      </th>
      {dates.map((date, colIndex) => {
        const value = grades[date] ?? null
        const isActive =
          activeCell?.studentId === studentId && activeCell?.date === date
        const isRowHovered = hoveredRowId === studentId
        const isColHovered = hoveredColIndex === colIndex
        return (
          <td
            key={date}
            className="h-12 w-16 border-r border-slate-200"
            onMouseEnter={() => onCellOpen(studentId, date)}
          >
            <JournalCell
              value={value}
              isActive={isActive}
              isRowHovered={isRowHovered}
              isColHovered={isColHovered}
              onOpen={() => onCellOpen(studentId, date)}
              onClose={onCellClose}
              draftValue={draftValue}
              onDraftChange={onDraftChange}
              onSave={() => onSave(studentId, date, draftValue)}
            />
          </td>
        )
      })}
      <td className="h-12 w-16 border-l border-slate-200">
        <JournalAverageCell value="—" />
      </td>
    </tr>
  )
}
