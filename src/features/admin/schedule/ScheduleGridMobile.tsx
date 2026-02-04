import type { AdminScheduleSlot } from '../../../types/adminSchedule'
import type { ActiveCell, SlotKey } from './utils'
import { makeSlotKey, WEEK_DAYS } from './utils'
import { ScheduleLessonCountControl } from './ScheduleLessonCountControl'

type ScheduleGridMobileProps = {
  lessonSlots: Array<{ lessonNumber: number; time: string }>
  currentByKey: Record<SlotKey, AdminScheduleSlot | null>
  dirtyKeys: Record<SlotKey, boolean>
  lessonCount: number
  onCellClick: (cell: ActiveCell) => void
  onLessonCountDecrease: () => void
  onLessonCountIncrease: () => void
}

export function ScheduleGridMobile({
  lessonSlots,
  currentByKey,
  dirtyKeys,
  lessonCount,
  onCellClick,
  onLessonCountDecrease,
  onLessonCountIncrease,
}: ScheduleGridMobileProps) {
  return (
    <>
      <div className="flex flex-col gap-4 md:hidden">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-lg font-semibold text-slate-900">{day}</div>
            <div className="mt-3 flex flex-col gap-3">
              {lessonSlots.map((slot) => {
                const key = makeSlotKey(day, slot.lessonNumber)
                const cell = currentByKey[key]
                const isDirty = Boolean(dirtyKeys[key])
                return (
                  <div key={key} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-base font-semibold text-slate-900">
                        Урок {slot.lessonNumber} · {slot.time}
                      </div>
                      {isDirty && cell ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                          Изменено
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                      {cell ? (
                        <>
                          <div className="text-base font-semibold text-slate-900">
                            {cell.subjectName}
                          </div>
                          <div>{cell.teacherName}</div>
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
                          <div className="text-sm text-slate-400">Свободно</div>
                          <div className="text-sm font-semibold text-slate-700">
                            + Назначить
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onCellClick({
                          dayLabel: day,
                          lessonNumber: slot.lessonNumber,
                          time: slot.time,
                        })
                      }
                      className="mt-3 h-12 w-full rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-700"
                    >
                      Изменить
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500">
        На телефоне расписание показывается списком по дням.
      </div>
      <div className="md:hidden">
        <ScheduleLessonCountControl
          lessonCount={lessonCount}
          onDecrease={onLessonCountDecrease}
          onIncrease={onLessonCountIncrease}
          variant="mobile"
        />
      </div>
    </>
  )
}
