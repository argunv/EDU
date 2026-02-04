import type { AdminScheduleSlot } from '../../../types/adminSchedule'
import type { ActiveCell, SlotKey } from './utils'
import { makeSlotKey, WEEK_DAYS } from './utils'
import { ScheduleLessonCountControl } from './ScheduleLessonCountControl'

type ScheduleGridDesktopProps = {
  lessonSlots: Array<{ lessonNumber: number; time: string }>
  currentByKey: Record<SlotKey, AdminScheduleSlot | null>
  dirtyKeys: Record<SlotKey, boolean>
  lessonCount: number
  onCellClick: (cell: ActiveCell) => void
  onLessonCountDecrease: () => void
  onLessonCountIncrease: () => void
}

export function ScheduleGridDesktop({
  lessonSlots,
  currentByKey,
  dirtyKeys,
  lessonCount,
  onCellClick,
  onLessonCountDecrease,
  onLessonCountIncrease,
}: ScheduleGridDesktopProps) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="w-28 px-3 py-3 text-left text-sm font-semibold text-slate-700">
              Урок
            </th>
            {WEEK_DAYS.map((day) => (
              <th
                key={day}
                className="px-3 py-3 text-left text-sm font-semibold text-slate-700"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lessonSlots.map((slot) => (
            <tr key={slot.lessonNumber} className="border-b border-slate-200">
              <td className="px-3 py-3 align-top">
                <div className="text-sm font-semibold text-slate-900">
                  Урок {slot.lessonNumber}
                </div>
                <div className="text-xs text-slate-500">{slot.time}</div>
              </td>
              {WEEK_DAYS.map((day) => {
                const key = makeSlotKey(day, slot.lessonNumber)
                const cell = currentByKey[key]
                const isDirty = Boolean(dirtyKeys[key])
                const cellContent = cell ? (
                  <>
                    <div
                      className="min-w-0 truncate text-base font-semibold text-slate-900"
                      title={cell.subjectName}
                    >
                      {cell.subjectName}
                    </div>
                    <div
                      className="min-w-0 truncate text-sm text-slate-600"
                      title={cell.teacherName}
                    >
                      {cell.teacherName}
                    </div>
                    {cell.isCancelled ? (
                      <div className="mt-1 text-xs font-semibold text-rose-600">
                        Урок отменён
                      </div>
                    ) : null}
                    {cell.note ? (
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        Комментарий
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="min-w-0 truncate text-sm text-slate-400">Свободно</div>
                    <div className="min-w-0 truncate text-sm font-semibold text-slate-700">
                      + Назначить
                    </div>
                  </>
                )

                return (
                  <td key={key} className="min-w-0 overflow-hidden px-3 py-3 align-top">
                    <button
                      type="button"
                      onClick={() =>
                        onCellClick({
                          dayLabel: day,
                          lessonNumber: slot.lessonNumber,
                          time: slot.time,
                        })
                      }
                      className="flex h-28 min-w-0 w-full flex-col gap-2 overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-3 text-left hover:border-slate-300"
                    >
                      {cellContent}
                      {isDirty && cell ? (
                        <span className="mt-auto inline-flex w-fit rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                          Изменено
                        </span>
                      ) : null}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <td colSpan={WEEK_DAYS.length + 1} className="px-3 py-3">
              <ScheduleLessonCountControl
                lessonCount={lessonCount}
                onDecrease={onLessonCountDecrease}
                onIncrease={onLessonCountIncrease}
                variant="desktop"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
